import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";

import type { OpenAIQuality } from "./seedream-options";

const encoder = new Tiktoken(o200kBase);

const OUTPUT_TOKEN_BASE_BY_QUALITY: Record<OpenAIQuality, number> = {
  low: 16,
  medium: 48,
  high: 96,
};

const IMAGE_INPUT_BASE_TOKENS_HIGH_DETAIL = 85;
const IMAGE_INPUT_TILE_TOKENS_HIGH_DETAIL = 170;
const IMAGE_INPUT_TILE_SIZE = 512;
const IMAGE_INPUT_MAX_DIMENSION = 2048;
const IMAGE_INPUT_TARGET_SHORT_SIDE = 768;

export const OPENAI_GPT_IMAGE_2_PRICING = {
  textInputPerMillion: 5,
  textCachedInputPerMillion: 1.25,
  imageInputPerMillion: 8,
  imageCachedInputPerMillion: 2,
  imageOutputPerMillion: 30,
} as const;

export type OpenAIEstimatedCostBreakdown = {
  size: { width: number; height: number };
  quality: OpenAIQuality;
  imageCount: number;
  promptTextTokens: number;
  inputImageTokens: number;
  outputTokensPerImage: number;
  outputTokensTotal: number;
  inputTextCostUsd: number;
  inputImageCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

export type OpenAIUsageBreakdown = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  inputTextTokens: number | null;
  inputImageTokens: number | null;
  cachedInputTokens: number | null;
  cachedTextTokens: number | null;
  cachedImageTokens: number | null;
};

export type OpenAIActualCostBreakdown = {
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
};

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  return null;
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function scaleToFit(width: number, height: number, maxDimension: number) {
  const largestSide = Math.max(width, height);
  if (largestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function estimateOpenAITextTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return encoder.encode(normalized).length;
}

export function estimateGptImage2OutputTokens(
  size: { width: number; height: number },
  quality: OpenAIQuality,
): number {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const baseTokens = OUTPUT_TOKEN_BASE_BY_QUALITY[quality];
  const scaledShortSide = Math.round((baseTokens * shortSide) / longSide);
  const horizontalTokens = width >= height ? baseTokens : scaledShortSide;
  const verticalTokens = width >= height ? scaledShortSide : baseTokens;
  const rasterTokens = horizontalTokens * verticalTokens;

  return Math.ceil((rasterTokens * (2_000_000 + width * height)) / 4_000_000);
}

export function estimateHighDetailImageInputTokens(size: {
  width: number;
  height: number;
}): number {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const fitted = scaleToFit(width, height, IMAGE_INPUT_MAX_DIMENSION);
  const shortestSide = Math.min(fitted.width, fitted.height);
  const shortestSideScale =
    shortestSide > 0 ? IMAGE_INPUT_TARGET_SHORT_SIDE / shortestSide : 1;
  const normalized = {
    width: Math.max(1, Math.round(fitted.width * shortestSideScale)),
    height: Math.max(1, Math.round(fitted.height * shortestSideScale)),
  };
  const tiles =
    Math.ceil(normalized.width / IMAGE_INPUT_TILE_SIZE) *
    Math.ceil(normalized.height / IMAGE_INPUT_TILE_SIZE);

  return IMAGE_INPUT_BASE_TOKENS_HIGH_DETAIL + tiles * IMAGE_INPUT_TILE_TOKENS_HIGH_DETAIL;
}

export function estimateOpenAIImageRequestCost(args: {
  prompt: string;
  size: { width: number; height: number };
  quality: OpenAIQuality;
  imageCount: number;
  inputImages: Array<{ width?: number | null; height?: number | null }>;
}): OpenAIEstimatedCostBreakdown {
  const promptTextTokens = estimateOpenAITextTokens(args.prompt);
  const inputImageTokens = args.inputImages.reduce((total, image) => {
    if (!image.width || !image.height) {
      return total;
    }

    return total + estimateHighDetailImageInputTokens({ width: image.width, height: image.height });
  }, 0);
  const outputTokensPerImage = estimateGptImage2OutputTokens(args.size, args.quality);
  const imageCount = Math.max(1, Math.round(args.imageCount));
  const outputTokensTotal = outputTokensPerImage * imageCount;
  const inputTextCostUsd =
    (promptTextTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.textInputPerMillion;
  const inputImageCostUsd =
    (inputImageTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.imageInputPerMillion;
  const outputCostUsd =
    (outputTokensTotal / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.imageOutputPerMillion;

  return {
    size: args.size,
    quality: args.quality,
    imageCount,
    promptTextTokens,
    inputImageTokens,
    outputTokensPerImage,
    outputTokensTotal,
    inputTextCostUsd,
    inputImageCostUsd,
    outputCostUsd,
    totalCostUsd: inputTextCostUsd + inputImageCostUsd + outputCostUsd,
  };
}

export function normalizeOpenAIUsage(usage: unknown): OpenAIUsageBreakdown | null {
  const usageObject = getObject(usage);
  if (!usageObject) {
    return null;
  }

  const inputTokens = toPositiveInteger(usageObject.input_tokens);
  const outputTokens = toPositiveInteger(usageObject.output_tokens);
  const totalTokens = toPositiveInteger(usageObject.total_tokens);
  const inputDetails = getObject(usageObject.input_tokens_details);
  const cachedDetails = getObject(usageObject.cached_input_tokens_details);

  const inputTextTokens =
    toPositiveInteger(inputDetails?.text_tokens) ??
    toPositiveInteger(usageObject.text_tokens);
  const inputImageTokens =
    toPositiveInteger(inputDetails?.image_tokens) ??
    toPositiveInteger(usageObject.image_tokens);
  const cachedInputTokens =
    toPositiveInteger(inputDetails?.cached_tokens) ??
    toPositiveInteger(usageObject.cached_input_tokens);
  const cachedTextTokens =
    toPositiveInteger(cachedDetails?.text_tokens) ??
    toPositiveInteger(inputDetails?.cached_text_tokens);
  const cachedImageTokens =
    toPositiveInteger(cachedDetails?.image_tokens) ??
    toPositiveInteger(inputDetails?.cached_image_tokens);

  if (
    inputTokens === null &&
    outputTokens === null &&
    totalTokens === null &&
    inputTextTokens === null &&
    inputImageTokens === null
  ) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputTextTokens,
    inputImageTokens,
    cachedInputTokens,
    cachedTextTokens,
    cachedImageTokens,
  };
}

export function calculateOpenAIActualCost(usage: OpenAIUsageBreakdown | null): OpenAIActualCostBreakdown {
  if (!usage) {
    return {
      inputCostUsd: null,
      outputCostUsd: null,
      totalCostUsd: null,
    };
  }

  const cachedTextTokens = usage.cachedTextTokens ?? 0;
  const cachedImageTokens = usage.cachedImageTokens ?? 0;
  const nonCachedTextTokens =
    usage.inputTextTokens !== null
      ? Math.max(0, usage.inputTextTokens - cachedTextTokens)
      : null;
  const nonCachedImageTokens =
    usage.inputImageTokens !== null
      ? Math.max(0, usage.inputImageTokens - cachedImageTokens)
      : null;

  const inputCostUsd =
    nonCachedTextTokens !== null && nonCachedImageTokens !== null
      ? (nonCachedTextTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.textInputPerMillion +
        (cachedTextTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.textCachedInputPerMillion +
        (nonCachedImageTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.imageInputPerMillion +
        (cachedImageTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.imageCachedInputPerMillion
      : null;
  const outputCostUsd =
    usage.outputTokens !== null
      ? (usage.outputTokens / 1_000_000) * OPENAI_GPT_IMAGE_2_PRICING.imageOutputPerMillion
      : null;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd:
      inputCostUsd !== null && outputCostUsd !== null ? inputCostUsd + outputCostUsd : null,
  };
}

