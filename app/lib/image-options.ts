import {
  getEnumValues,
  type ImageModel,
  type ImageModelEndpoint,
  type OutputFormat,
  type SupportedParameters,
} from "./openrouter";

/** "auto" means the parameter is omitted so the provider picks its default. */
export type AspectSelection = string;
export type ResolutionSelection = string;
export type QualitySelection = string;

export const AUTO_OPTION = "auto";

export const DEFAULT_ASPECT_RATIO = "9:16";
export const DEFAULT_RESOLUTION = "2K";
export const DEFAULT_QUALITY = "medium";

export const GPT_IMAGE_2_MODEL_ID = "openai/gpt-image-2";
export const GPT_IMAGE_2_RESOLUTION_OPTIONS = ["1K", "2K", "4K"] as const;

const ASPECT_RATIO_LABELS: Record<string, string> = {
  "1:1": "Square",
  "1:2": "Tall",
  "2:1": "Wide",
  "1:4": "Banner",
  "4:1": "Banner",
  "2:3": "Classic",
  "3:2": "Classic",
  "3:4": "Tall",
  "4:3": "Standard",
  "4:5": "Social",
  "5:4": "Print",
  "9:16": "Story",
  "16:9": "Widescreen",
  "9:21": "Ultra Tall",
  "21:9": "Cinematic",
};

const ASPECT_RATIO_ORDER = [
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "1:2",
  "9:21",
  "1:4",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "2:1",
  "21:9",
  "4:1",
];

const RESOLUTION_ORDER = ["512", "1K", "2K", "4K"];

/** Aspect option slugs used before the OpenRouter migration, mapped to ratio strings. */
export const LEGACY_ASPECT_RATIO_BY_KEY: Record<string, string> = {
  "square-1-1": "1:1",
  "portrait-1-2": "1:2",
  "portrait-1-4": "1:4",
  "portrait-1-8": "1:8",
  "portrait-2-3": "2:3",
  "portrait-3-4": "3:4",
  "portrait-4-5": "4:5",
  "portrait-9-16": "9:16",
  "landscape-2-1": "2:1",
  "landscape-4-1": "4:1",
  "landscape-8-1": "8:1",
  "landscape-3-2": "3:2",
  "landscape-4-3": "4:3",
  "landscape-5-4": "5:4",
  "landscape-16-9": "16:9",
  "landscape-21-9": "21:9",
};

const QUALITY_LABELS: Record<string, string> = {
  auto: "Auto",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const OUTPUT_FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WEBP" },
];

export function getAspectRatioLabel(ratio: string): string {
  if (ratio === AUTO_OPTION) {
    return "Auto";
  }

  return ASPECT_RATIO_LABELS[ratio] ?? ratio;
}

export function getQualityLabel(quality: string | null | undefined): string {
  if (!quality) {
    return "Default";
  }

  return QUALITY_LABELS[quality] ?? quality;
}

function sortByReference(values: string[], reference: string[]): string[] {
  return [...values].sort((a, b) => {
    const indexA = reference.indexOf(a);
    const indexB = reference.indexOf(b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }
    return indexA - indexB;
  });
}

/**
 * The parameter surface for the active model: the pinned provider endpoint's
 * parameters when available, otherwise the model-level union.
 */
export function resolveActiveParameters(
  model: ImageModel | null,
  pinnedEndpoint: ImageModelEndpoint | null,
): SupportedParameters | null {
  if (pinnedEndpoint) {
    return pinnedEndpoint.supported_parameters;
  }

  return model?.supported_parameters ?? null;
}

export function getSupportedAspectRatios(parameters: SupportedParameters | null): string[] {
  const values = parameters ? getEnumValues(parameters, "aspect_ratio") : null;
  if (!values) {
    return [];
  }

  return sortByReference(values.filter((value) => value !== AUTO_OPTION), ASPECT_RATIO_ORDER);
}

export function getSupportedResolutions(
  parameters: SupportedParameters | null,
  modelId?: string | null,
): string[] {
  // OpenRouter accepts explicit sizes and resolution tiers for GPT Image 2,
  // even though its discovery record currently omits both capabilities.
  if (modelId === GPT_IMAGE_2_MODEL_ID) {
    return [...GPT_IMAGE_2_RESOLUTION_OPTIONS];
  }

  const values = parameters ? getEnumValues(parameters, "resolution") : null;
  if (!values) {
    return [];
  }

  return sortByReference(values, RESOLUTION_ORDER);
}

export function getSupportedQualities(parameters: SupportedParameters | null): string[] {
  const values = parameters ? getEnumValues(parameters, "quality") : null;
  if (!values) {
    return [];
  }

  return values.filter((value) => value !== AUTO_OPTION);
}

export function getSupportedOutputFormats(
  parameters: SupportedParameters | null,
): OutputFormat[] | null {
  const values = parameters ? getEnumValues(parameters, "output_format") : null;
  if (!values) {
    return null;
  }

  return OUTPUT_FORMAT_OPTIONS.map((option) => option.value).filter((format) =>
    values.includes(format),
  );
}

export function parseAspectRatio(ratio: string): { width: number; height: number } | null {
  const match = ratio.match(/^(\d+):(\d+)$/);
  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

const RESOLUTION_LONG_EDGE: Record<string, number> = {
  "512": 512,
  "1K": 1024,
  "2K": 2048,
  "4K": 4096,
};

const GPT_IMAGE_2_MAX_EDGE = 3840;
const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
const SIZE_MULTIPLE = 16;

function roundToSizeMultiple(value: number): number {
  return Math.max(SIZE_MULTIPLE, Math.round(value / SIZE_MULTIPLE) * SIZE_MULTIPLE);
}

function floorToSizeMultiple(value: number): number {
  return Math.max(SIZE_MULTIPLE, Math.floor(value / SIZE_MULTIPLE) * SIZE_MULTIPLE);
}

/**
 * Converts a GPT Image 2 resolution tier and ratio into an explicit size.
 *
 * 1K keeps the short edge near 1024 (matching 1536x1024 for 3:2), 2K keeps
 * the long edge at 2048, and 4K keeps the long edge at 3840 whenever the
 * 8,294,400-pixel ceiling allows it. Every edge is a multiple of 16.
 */
export function getGptImage2Size(
  resolution: string | null | undefined,
  aspectRatio: string | null | undefined,
): { width: number; height: number } | null {
  if (!resolution || !GPT_IMAGE_2_RESOLUTION_OPTIONS.includes(
    resolution as (typeof GPT_IMAGE_2_RESOLUTION_OPTIONS)[number],
  )) {
    return null;
  }

  const ratio = aspectRatio ? parseAspectRatio(aspectRatio) : null;
  if (!ratio) {
    return null;
  }

  const landscape = ratio.width >= ratio.height;
  const longToShort = Math.max(ratio.width, ratio.height) / Math.min(ratio.width, ratio.height);
  let longEdge: number;
  let shortEdge: number;

  if (resolution === "1K") {
    shortEdge = 1024;
    longEdge = roundToSizeMultiple(shortEdge * longToShort);
  } else if (resolution === "2K") {
    longEdge = 2048;
    shortEdge = roundToSizeMultiple(longEdge / longToShort);
  } else {
    longEdge = GPT_IMAGE_2_MAX_EDGE;
    shortEdge = roundToSizeMultiple(longEdge / longToShort);

    if (longEdge * shortEdge > GPT_IMAGE_2_MAX_PIXELS) {
      longEdge = floorToSizeMultiple(Math.sqrt(GPT_IMAGE_2_MAX_PIXELS * longToShort));
      shortEdge = floorToSizeMultiple(longEdge / longToShort);
    }
  }

  while (longEdge * shortEdge > GPT_IMAGE_2_MAX_PIXELS) {
    if (longEdge >= shortEdge) {
      longEdge -= SIZE_MULTIPLE;
    } else {
      shortEdge -= SIZE_MULTIPLE;
    }
  }

  return landscape
    ? { width: longEdge, height: shortEdge }
    : { width: shortEdge, height: longEdge };
}

export function formatImageSize(size: { width: number; height: number }): string {
  return `${size.width}x${size.height}`;
}

/**
 * Best-effort output size for layout purposes; the real size is measured from
 * the returned image once generation completes.
 */
export function estimateImageSize(
  aspectRatio: string,
  resolution: string | null,
): { width: number; height: number } {
  const longEdge = (resolution && RESOLUTION_LONG_EDGE[resolution]) || 1024;
  const ratio = parseAspectRatio(aspectRatio);
  if (!ratio) {
    return { width: longEdge, height: longEdge };
  }

  if (ratio.width >= ratio.height) {
    return {
      width: longEdge,
      height: Math.max(1, Math.round((longEdge * ratio.height) / ratio.width)),
    };
  }

  return {
    width: Math.max(1, Math.round((longEdge * ratio.width) / ratio.height)),
    height: longEdge,
  };
}

export function deriveAspectRatioFromSize(size: { width: number; height: number }): string {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  let a = width;
  let b = height;

  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }

  const divisor = Math.max(1, a);
  return `${Math.max(1, Math.round(width / divisor))}:${Math.max(1, Math.round(height / divisor))}`;
}

export function formatResolution(size: { width: number; height: number }): string {
  return `${size.width}×${size.height}`;
}
