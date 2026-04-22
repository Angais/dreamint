export type Provider = "fal" | "gemini" | "openai";
export type OutputFormat = "png" | "jpeg" | "webp";
export type GeminiModelVariant = "pro" | "flash";
export type FlashReasoningLevel = "minimal" | "high";
export type OpenAIModel = "gpt-image-2";
export type OpenAIModelSelection = OpenAIModel;
export type OpenAIQuality = "low" | "medium" | "high";
export type AspectSelection = AspectKey | "auto";
export type QualitySelection = QualityKey | "auto";

export const DEFAULT_GEMINI_MODEL_VARIANT: GeminiModelVariant = "pro";
export const DEFAULT_FLASH_REASONING_LEVEL: FlashReasoningLevel = "high";
export const DEFAULT_OPENAI_MODEL: OpenAIModel = "gpt-image-2";
export const DEFAULT_OPENAI_QUALITY: OpenAIQuality = "medium";

export const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
];

export type AspectKey =
  | "square-1-1"
  | "portrait-1-4"
  | "portrait-1-8"
  | "portrait-2-3"
  | "portrait-3-4"
  | "portrait-4-5"
  | "portrait-9-16"
  | "landscape-4-1"
  | "landscape-8-1"
  | "landscape-3-2"
  | "landscape-4-3"
  | "landscape-5-4"
  | "landscape-16-9"
  | "landscape-21-9";

export type QualityKey = "1k" | "2k" | "4k";
export type OpenAIResolutionMode = "preset" | "custom";

type AspectDefinition = {
  value: AspectKey;
  label: string;
  description: string;
  widthRatio: number;
  heightRatio: number;
  orientation: "square" | "portrait" | "landscape" | "ultrawide";
};

type QualityDefinition = {
  value: QualityKey;
  label: string;
  description: string;
  maxDimension: number;
};

type OutputFormatDefinition = {
  value: OutputFormat;
  label: string;
};

type OpenAIQualityDefinition = {
  value: OpenAIQuality;
  label: string;
  description: string;
};

type OpenAIModelDefinition = {
  value: OpenAIModel;
  label: string;
};

export const ASPECT_OPTIONS: AspectDefinition[] = [
  {
    value: "square-1-1",
    label: "Square",
    description: "1 : 1",
    widthRatio: 1,
    heightRatio: 1,
    orientation: "square",
  },
  {
    value: "portrait-1-4",
    label: "Banner",
    description: "1 : 4",
    widthRatio: 1,
    heightRatio: 4,
    orientation: "portrait",
  },
  {
    value: "portrait-1-8",
    label: "Ultra Tall",
    description: "1 : 8",
    widthRatio: 1,
    heightRatio: 8,
    orientation: "portrait",
  },
  {
    value: "portrait-2-3",
    label: "Classic",
    description: "2 : 3",
    widthRatio: 2,
    heightRatio: 3,
    orientation: "portrait",
  },
  {
    value: "portrait-3-4",
    label: "Tall",
    description: "3 : 4",
    widthRatio: 3,
    heightRatio: 4,
    orientation: "portrait",
  },
  {
    value: "portrait-4-5",
    label: "Social",
    description: "4 : 5",
    widthRatio: 4,
    heightRatio: 5,
    orientation: "portrait",
  },
  {
    value: "portrait-9-16",
    label: "Story",
    description: "9 : 16",
    widthRatio: 9,
    heightRatio: 16,
    orientation: "portrait",
  },
  {
    value: "landscape-4-1",
    label: "Banner",
    description: "4 : 1",
    widthRatio: 4,
    heightRatio: 1,
    orientation: "ultrawide",
  },
  {
    value: "landscape-8-1",
    label: "Ultra Wide",
    description: "8 : 1",
    widthRatio: 8,
    heightRatio: 1,
    orientation: "ultrawide",
  },
  {
    value: "landscape-3-2",
    label: "Classic",
    description: "3 : 2",
    widthRatio: 3,
    heightRatio: 2,
    orientation: "landscape",
  },
  {
    value: "landscape-4-3",
    label: "Standard",
    description: "4 : 3",
    widthRatio: 4,
    heightRatio: 3,
    orientation: "landscape",
  },
  {
    value: "landscape-5-4",
    label: "Print",
    description: "5 : 4",
    widthRatio: 5,
    heightRatio: 4,
    orientation: "landscape",
  },
  {
    value: "landscape-16-9",
    label: "Widescreen",
    description: "16 : 9",
    widthRatio: 16,
    heightRatio: 9,
    orientation: "landscape",
  },
  {
    value: "landscape-21-9",
    label: "Cinematic",
    description: "21 : 9",
    widthRatio: 21,
    heightRatio: 9,
    orientation: "ultrawide",
  },
];

export const FLASH_ONLY_ASPECTS: AspectKey[] = [
  "portrait-1-4",
  "portrait-1-8",
  "landscape-4-1",
  "landscape-8-1",
];

export const QUALITY_OPTIONS: QualityDefinition[] = [
  {
    value: "1k",
    label: "1K",
    description: "Fast (1024px)",
    maxDimension: 1024,
  },
  {
    value: "2k",
    label: "2K",
    description: "Detailed (2048px)",
    maxDimension: 2048,
  },
  {
    value: "4k",
    label: "4K",
    description: "Max within provider limits",
    maxDimension: 3824,
  },
];

export const OPENAI_CONCRETE_MODELS: OpenAIModel[] = [
  "gpt-image-2",
];

export const OPENAI_MODEL_OPTIONS: OpenAIModelDefinition[] = [
  { value: "gpt-image-2", label: "gpt-image-2" },
];

export const OPENAI_QUALITY_OPTIONS: OpenAIQualityDefinition[] = [
  { value: "low", label: "Low", description: "Fastest" },
  { value: "medium", label: "Medium", description: "Balanced" },
  { value: "high", label: "High", description: "Highest detail" },
];

export const OUTPUT_FORMAT_OPTIONS: OutputFormatDefinition[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WEBP" },
];

export const OPENAI_IMAGE_SIZE_LIMITS = {
  maxEdgeExclusive: 3840,
  maxEdge: 3824,
  multipleOf: 16,
  maxAspectRatio: 3,
  maxPixels: 8_294_400,
  minPixels: 655_360,
} as const;

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function getOpenAIScaleStep(widthRatio: number, heightRatio: number): number {
  const widthStep = OPENAI_IMAGE_SIZE_LIMITS.multipleOf / gcd(widthRatio, OPENAI_IMAGE_SIZE_LIMITS.multipleOf);
  const heightStep = OPENAI_IMAGE_SIZE_LIMITS.multipleOf / gcd(heightRatio, OPENAI_IMAGE_SIZE_LIMITS.multipleOf);
  return lcm(widthStep, heightStep);
}

function snapScaleToStep(scale: number, step: number, direction: "down" | "up" | "nearest"): number {
  if (step <= 0) {
    return Math.max(1, Math.round(scale));
  }

  const down = Math.floor(scale / step) * step;
  const up = Math.ceil(scale / step) * step;

  if (direction === "down") {
    return Math.max(step, down || step);
  }

  if (direction === "up") {
    return Math.max(step, up || step);
  }

  const safeDown = down > 0 ? down : step;
  const safeUp = up > 0 ? up : step;
  return Math.abs(safeDown - scale) <= Math.abs(safeUp - scale) ? safeDown : safeUp;
}

function getAspectRatios(size: { width: number; height: number }) {
  const divisor = gcd(size.width, size.height);
  return {
    widthRatio: Math.max(1, Math.round(size.width / divisor)),
    heightRatio: Math.max(1, Math.round(size.height / divisor)),
  };
}

function getOpenAIScaleRange(widthRatio: number, heightRatio: number) {
  const maxRatioEdge = Math.max(widthRatio, heightRatio);
  const minScaleFromPixels = Math.sqrt(OPENAI_IMAGE_SIZE_LIMITS.minPixels / (widthRatio * heightRatio));
  const maxScaleFromPixels = Math.sqrt(OPENAI_IMAGE_SIZE_LIMITS.maxPixels / (widthRatio * heightRatio));
  const maxScaleFromEdge = OPENAI_IMAGE_SIZE_LIMITS.maxEdge / maxRatioEdge;

  return {
    min: minScaleFromPixels,
    max: Math.min(maxScaleFromPixels, maxScaleFromEdge),
  };
}

function clampOpenAIScale(widthRatio: number, heightRatio: number, targetScale: number): number {
  const step = getOpenAIScaleStep(widthRatio, heightRatio);
  const range = getOpenAIScaleRange(widthRatio, heightRatio);

  if (range.max < step) {
    throw new Error("This aspect ratio is outside OpenAI's size constraints.");
  }

  const snappedNearest = snapScaleToStep(targetScale, step, "nearest");
  const snappedDown = snapScaleToStep(targetScale, step, "down");
  const snappedUp = snapScaleToStep(targetScale, step, "up");
  const candidates = [snappedNearest, snappedDown, snappedUp]
    .filter((value, index, list) => list.indexOf(value) === index)
    .filter((value) => value >= Math.ceil(range.min) - step && value <= Math.floor(range.max) + step);

  const validCandidate = candidates.find((candidate) => {
    const nextSize = { width: widthRatio * candidate, height: heightRatio * candidate };
    return getOpenAIImageSizeError(nextSize) === null;
  });

  if (validCandidate) {
    return validCandidate;
  }

  const preferredDirection = targetScale < range.min ? "up" : "down";
  const fallbackScale = snapScaleToStep(
    Math.min(Math.max(targetScale, range.min), range.max),
    step,
    preferredDirection,
  );
  const fallbackSize = { width: widthRatio * fallbackScale, height: heightRatio * fallbackScale };
  if (getOpenAIImageSizeError(fallbackSize) === null) {
    return fallbackScale;
  }

  throw new Error("Unable to find a valid OpenAI image size for this ratio.");
}

export function getAspectDefinition(value: AspectKey): AspectDefinition | undefined {
  return ASPECT_OPTIONS.find((option) => option.value === value);
}

export function isFlashOnlyAspect(value: AspectKey): boolean {
  return FLASH_ONLY_ASPECTS.includes(value);
}

export function supportsOpenAIAspect(value: AspectKey): boolean {
  const aspectDefinition = getAspectDefinition(value);
  if (!aspectDefinition) {
    return false;
  }

  const longEdge = Math.max(aspectDefinition.widthRatio, aspectDefinition.heightRatio);
  const shortEdge = Math.min(aspectDefinition.widthRatio, aspectDefinition.heightRatio);
  return longEdge / shortEdge <= OPENAI_IMAGE_SIZE_LIMITS.maxAspectRatio;
}

export function getAspectOptionsForModel(
  provider: Provider,
  modelVariant: GeminiModelVariant,
): AspectDefinition[] {
  if (provider === "gemini" && modelVariant === "flash") {
    return ASPECT_OPTIONS;
  }

  if (provider === "openai") {
    return ASPECT_OPTIONS.filter((option) => supportsOpenAIAspect(option.value));
  }

  return ASPECT_OPTIONS.filter((option) => !isFlashOnlyAspect(option.value));
}

export function getQualityDefinition(value: QualityKey): QualityDefinition | undefined {
  return QUALITY_OPTIONS.find((option) => option.value === value);
}

export function getOpenAIQualityLabel(value: OpenAIQuality): string {
  return OPENAI_QUALITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getOpenAIModelLabel(value: OpenAIModel): string {
  return OPENAI_MODEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getProviderModelLabel(
  provider: Provider | undefined,
  geminiModelVariant?: GeminiModelVariant,
  openAIModel?: OpenAIModel,
): string {
  if (provider === "openai") {
    return getOpenAIModelLabel(openAIModel ?? DEFAULT_OPENAI_MODEL);
  }

  return geminiModelVariant === "flash" ? "3.1 Flash" : "3 Pro";
}

export function getAspectDescription(value: string): string {
  if (value === "auto") {
    return "Auto";
  }
  if (value === "custom") {
    return "Custom";
  }
  return getAspectDefinition(value as AspectKey)?.description ?? value;
}

export function getQualityLabel(value: QualitySelection): string {
  if (value === "auto") {
    return "Auto";
  }
  return getQualityDefinition(value)?.label ?? value;
}

export function getOutputFormatLabel(value: OutputFormat): string {
  return OUTPUT_FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? value.toUpperCase();
}

export function calculateImageSize(aspect: AspectKey, quality: QualityKey): { width: number; height: number } {
  const aspectDefinition = getAspectDefinition(aspect);
  const qualityDefinition = getQualityDefinition(quality);

  if (!aspectDefinition) {
    throw new Error(`Unknown aspect option: ${aspect}`);
  }

  if (!qualityDefinition) {
    throw new Error(`Unknown quality option: ${quality}`);
  }

  const { widthRatio, heightRatio } = aspectDefinition;
  const { maxDimension } = qualityDefinition;

  if (widthRatio === heightRatio) {
    return { width: maxDimension, height: maxDimension };
  }

  if (widthRatio > heightRatio) {
    const height = Math.round((maxDimension * heightRatio) / widthRatio);
    return { width: maxDimension, height };
  }

  const width = Math.round((maxDimension * widthRatio) / heightRatio);
  return { width, height: maxDimension };
}

export function calculateImageSizeFromReferenceRatio(
  size: { width: number; height: number },
  quality: QualityKey,
): { width: number; height: number } {
  const qualityDefinition = getQualityDefinition(quality);

  if (!qualityDefinition) {
    throw new Error(`Unknown quality option: ${quality}`);
  }

  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const longEdge = Math.max(width, height);
  const scale = qualityDefinition.maxDimension / longEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function calculateOpenAIImageSize(aspect: AspectKey, quality: QualityKey): { width: number; height: number } {
  const aspectDefinition = getAspectDefinition(aspect);
  const qualityDefinition = getQualityDefinition(quality);

  if (!aspectDefinition) {
    throw new Error(`Unknown aspect option: ${aspect}`);
  }

  if (!qualityDefinition) {
    throw new Error(`Unknown quality option: ${quality}`);
  }

  if (!supportsOpenAIAspect(aspect)) {
    throw new Error(`Aspect ratio ${aspectDefinition.description} exceeds OpenAI's 3:1 limit.`);
  }

  const { widthRatio, heightRatio } = aspectDefinition;
  const longEdgeTarget = qualityDefinition.maxDimension;
  const targetScale = longEdgeTarget / Math.max(widthRatio, heightRatio);
  const resolvedScale = clampOpenAIScale(widthRatio, heightRatio, targetScale);

  return {
    width: widthRatio * resolvedScale,
    height: heightRatio * resolvedScale,
  };
}

export function calculateOpenAIImageSizeForLongEdge(
  aspect: AspectKey,
  targetLongEdge: number,
): { width: number; height: number } {
  const aspectDefinition = getAspectDefinition(aspect);

  if (!aspectDefinition) {
    throw new Error(`Unknown aspect option: ${aspect}`);
  }

  if (!supportsOpenAIAspect(aspect)) {
    throw new Error(`Aspect ratio ${aspectDefinition.description} exceeds OpenAI's 3:1 limit.`);
  }

  const { widthRatio, heightRatio } = aspectDefinition;
  const resolvedScale = clampOpenAIScale(
    widthRatio,
    heightRatio,
    Math.max(1, targetLongEdge) / Math.max(widthRatio, heightRatio),
  );

  return {
    width: widthRatio * resolvedScale,
    height: heightRatio * resolvedScale,
  };
}

export function calculateOpenAIImageSizeFromReferenceRatio(
  size: { width: number; height: number },
  quality: QualityKey,
): { width: number; height: number } {
  const qualityDefinition = getQualityDefinition(quality);

  if (!qualityDefinition) {
    throw new Error(`Unknown quality option: ${quality}`);
  }

  const { widthRatio, heightRatio } = getAspectRatios(size);
  const resolvedScale = clampOpenAIScale(
    widthRatio,
    heightRatio,
    qualityDefinition.maxDimension / Math.max(widthRatio, heightRatio),
  );

  return {
    width: widthRatio * resolvedScale,
    height: heightRatio * resolvedScale,
  };
}

export function getOpenAIImageSizeError(size: { width: number; height: number }): string | null {
  const width = Math.round(size.width);
  const height = Math.round(size.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "Width and height must be positive integers.";
  }

  if (width % OPENAI_IMAGE_SIZE_LIMITS.multipleOf !== 0 || height % OPENAI_IMAGE_SIZE_LIMITS.multipleOf !== 0) {
    return `Width and height must be multiples of ${OPENAI_IMAGE_SIZE_LIMITS.multipleOf}.`;
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);

  if (longEdge >= OPENAI_IMAGE_SIZE_LIMITS.maxEdgeExclusive) {
    return `The maximum edge must be below ${OPENAI_IMAGE_SIZE_LIMITS.maxEdgeExclusive}px.`;
  }

  if (longEdge / shortEdge > OPENAI_IMAGE_SIZE_LIMITS.maxAspectRatio) {
    return `The aspect ratio cannot exceed ${OPENAI_IMAGE_SIZE_LIMITS.maxAspectRatio}:1.`;
  }

  const totalPixels = width * height;
  if (totalPixels > OPENAI_IMAGE_SIZE_LIMITS.maxPixels) {
    return `The requested resolution exceeds ${OPENAI_IMAGE_SIZE_LIMITS.maxPixels.toLocaleString()} pixels.`;
  }

  if (totalPixels < OPENAI_IMAGE_SIZE_LIMITS.minPixels) {
    return `The requested resolution must be at least ${OPENAI_IMAGE_SIZE_LIMITS.minPixels.toLocaleString()} pixels.`;
  }

  return null;
}

export function normalizeOpenAIReferenceSize(size: { width: number; height: number }): { width: number; height: number } {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));

  const exactError = getOpenAIImageSizeError({ width, height });
  if (exactError === null) {
    return { width, height };
  }

  const { widthRatio, heightRatio } = getAspectRatios({ width, height });
  const originalScale = width / widthRatio;
  const range = getOpenAIScaleRange(widthRatio, heightRatio);
  const step = getOpenAIScaleStep(widthRatio, heightRatio);
  const originalPixels = width * height;
  const preferredDirection =
    originalPixels < OPENAI_IMAGE_SIZE_LIMITS.minPixels || Math.max(width, height) < 1024 ? "up" : "nearest";
  const targetScale = preferredDirection === "up" ? Math.max(originalScale, range.min) : originalScale;
  const snappedScale = snapScaleToStep(targetScale, step, preferredDirection === "up" ? "up" : "nearest");
  const normalizedScale = clampOpenAIScale(widthRatio, heightRatio, snappedScale);

  return {
    width: widthRatio * normalizedScale,
    height: heightRatio * normalizedScale,
  };
}

export function formatResolution(size: { width: number; height: number }): string {
  return `${size.width}×${size.height}`;
}
