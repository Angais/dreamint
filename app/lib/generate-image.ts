"use client";

import {
  combineUsages,
  normalizeUsage,
  type GenerationUsage,
  type InputImage,
  type OutputFormat,
} from "./openrouter";

// Some image models can take minutes; use a generous timeout.
const DEFAULT_REQUEST_TIMEOUT_MS = 480_000;

export type GenerateImageArgs = {
  apiKey: string;
  model: string;
  prompt: string;
  numImages?: number;
  aspectRatio?: string | null;
  resolution?: string | null;
  size?: string | null;
  quality?: string | null;
  outputFormat?: OutputFormat | null;
  inputImages?: InputImage[];
  providerTag?: string | null;
  allowFallbacks?: boolean;
  /** Max value of `n` per request for the selected model; extra images are requested in parallel. */
  maxImagesPerRequest?: number;
  maxInputImages?: number;
};

export type GenerateImageResult = {
  images: string[];
  usage: GenerationUsage | null;
};

type ImagesResponse = {
  data?: Array<{ b64_json?: string; media_type?: string; url?: string }>;
  usage?: unknown;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractErrorMessage(responseText: string, status: number): string {
  try {
    const json = JSON.parse(responseText) as { error?: { message?: string } | string };
    if (typeof json.error === "string" && json.error) {
      return json.error;
    }
    if (typeof json.error === "object" && json.error?.message) {
      return json.error.message;
    }
  } catch {
    // Fall through to the raw text.
  }

  return `Request failed (${status}): ${responseText}`;
}

export async function generateImage({
  apiKey,
  model,
  prompt,
  numImages = 1,
  aspectRatio,
  resolution,
  size,
  quality,
  outputFormat,
  inputImages = [],
  providerTag,
  allowFallbacks = true,
  maxImagesPerRequest = 1,
  maxInputImages,
}: GenerateImageArgs): Promise<GenerateImageResult> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Prompt is required.");
  }

  const resolvedApiKey = apiKey.trim();
  if (!resolvedApiKey) {
    throw new Error("Missing OpenRouter API key. Add one in settings.");
  }

  if (!model.trim()) {
    throw new Error("Select a model before generating.");
  }

  const normalizedInputImages = inputImages
    .map((image) => ({
      ...image,
      url: typeof image.url === "string" ? image.url.trim() : "",
    }))
    .filter((image) => image.url.length > 0);
  const effectiveInputImages =
    typeof maxInputImages === "number"
      ? normalizedInputImages.slice(0, Math.max(0, maxInputImages))
      : normalizedInputImages;

  const requestedImages = Math.max(1, Math.min(10, Math.round(numImages)));
  const perRequest = Math.max(1, Math.min(requestedImages, Math.round(maxImagesPerRequest)));
  const batchSizes: number[] = [];
  for (let remaining = requestedImages; remaining > 0; remaining -= perRequest) {
    batchSizes.push(Math.min(perRequest, remaining));
  }

  const responses = await Promise.all(
    batchSizes.map(async (batchSize) => {
      const response = await fetchWithTimeout("/api/openrouter/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: resolvedApiKey,
          model,
          prompt: trimmedPrompt,
          numImages: batchSize,
          aspectRatio: aspectRatio ?? null,
          resolution: resolution ?? null,
          size: size ?? null,
          quality: quality ?? null,
          outputFormat: outputFormat ?? null,
          inputImages: effectiveInputImages.map((image) => ({ url: image.url })),
          providerTag: providerTag ?? null,
          allowFallbacks,
        }),
        cache: "no-store",
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`OpenRouter: ${extractErrorMessage(responseText, response.status)}`);
      }

      return JSON.parse(responseText) as ImagesResponse;
    }),
  );

  const images = responses
    .flatMap((json) => json.data ?? [])
    .map((item) => {
      if (typeof item?.b64_json === "string" && item.b64_json.length > 0) {
        const mediaType = item.media_type ?? "image/png";
        return `data:${mediaType};base64,${item.b64_json}`;
      }
      if (typeof item?.url === "string" && item.url.length > 0) {
        return item.url;
      }
      return null;
    })
    .filter((image): image is string => typeof image === "string" && image.length > 0);

  if (images.length === 0) {
    throw new Error("No images returned from OpenRouter.");
  }

  return {
    images,
    usage: combineUsages(responses.map((json) => normalizeUsage(json.usage))),
  };
}
