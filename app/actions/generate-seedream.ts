"use server";

import "server-only";

import {
  calculateImageSize,
  getAspectDefinition,
  getQualityDefinition,
  type AspectKey,
  type QualityKey,
} from "../lib/seedream-options";

const MIN_IMAGE_DIMENSION = 512;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_MODEL_INPUT_IMAGES = 10;

export type InputImage = {
  id: string;
  name: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

type GenerateAspect = AspectKey | "custom";

export type GenerateSeedreamArgs = {
  prompt: string;
  aspect: GenerateAspect;
  quality: QualityKey;
  seed?: number | null;
  apiKey?: string;
  sizeOverride?: { width: number; height: number };
  inputImages?: InputImage[];
};

export type SeedreamGeneration = {
  prompt: string;
  aspect: GenerateAspect;
  quality: QualityKey;
  seed: number | null;
  createdAt: string;
  size: { width: number; height: number };
  images: string[];
  inputImages: InputImage[];
};

export async function generateSeedream({
  prompt,
  aspect,
  quality,
  seed,
  apiKey,
  sizeOverride,
  inputImages = [],
}: GenerateSeedreamArgs): Promise<SeedreamGeneration> {
  const resolvedApiKey = (apiKey ?? "").trim() || process.env.FAL_API_KEY;

  if (!resolvedApiKey) {
    throw new Error("Missing FAL API key. Add one in settings or set FAL_API_KEY.");
  }

  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt is required.");
  }

  if (aspect !== "custom") {
    const aspectDefinition = getAspectDefinition(aspect);
    if (!aspectDefinition) {
      throw new Error(`Unsupported aspect option: ${aspect}`);
    }
  }

  const qualityDefinition = getQualityDefinition(quality);
  if (!qualityDefinition) {
    throw new Error(`Unsupported quality option: ${quality}`);
  }

  let size: { width: number; height: number };

  if (sizeOverride) {
    const width = Math.round(sizeOverride.width);
    const height = Math.round(sizeOverride.height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error("Custom resolution must be numeric.");
    }

    if (
      width < MIN_IMAGE_DIMENSION ||
      width > MAX_IMAGE_DIMENSION ||
      height < MIN_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION
    ) {
      throw new Error(
        `Custom resolution must be between ${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION} pixels.`,
      );
    }

    size = { width, height };
  } else {
    if (aspect === "custom") {
      throw new Error("Custom aspect requires a size override.");
    }

    size = calculateImageSize(aspect, quality);
  }

  const normalizedInputImages = inputImages
    .map((image) => ({
      id: image.id,
      name: image.name ?? "Reference image",
      url: typeof image.url === "string" ? image.url.trim() : "",
      width: typeof image.width === "number" && Number.isFinite(image.width) ? image.width : null,
      height: typeof image.height === "number" && Number.isFinite(image.height) ? image.height : null,
    }))
    .filter((image) => image.url.length > 0);

  const effectiveInputImages = normalizedInputImages.slice(0, MAX_MODEL_INPUT_IMAGES);
  const useEditEndpoint = effectiveInputImages.length > 0;

  const payload: Record<string, unknown> = {
    prompt: trimmedPrompt,
    image_size: size,
    // Request four sequential generations 
    num_images: 4,
    max_images: 1,
    sync_mode: true,
    enable_safety_checker: false,
  };

  if (useEditEndpoint) {
    const requestedOutputs =
      typeof payload.num_images === "number" && Number.isFinite(payload.num_images)
        ? (payload.num_images as number)
        : 1;

    if (effectiveInputImages.length + requestedOutputs > 15) {
      throw new Error("Total number of images (input + output) must not exceed 15.");
    }

    payload.image_urls = effectiveInputImages.map((image) => image.url);
  }

  if (typeof seed === "number" && Number.isFinite(seed)) {
    payload.seed = seed;
  }

  const endpoint = useEditEndpoint
    ? "https://fal.run/fal-ai/bytedance/seedream/v4/edit"
    : "https://fal.run/fal-ai/bytedance/seedream/v4/text-to-image";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${resolvedApiKey}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Seedream request failed (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    images?: { url?: string }[];
    seed?: number;
  };

  const images = (json.images ?? [])
    .map((item) => item?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  if (images.length === 0) {
    throw new Error("Seedream did not return any images.");
  }

  return {
    prompt: trimmedPrompt,
    aspect,
    quality,
    seed: json.seed ?? null,
    size,
    createdAt: new Date().toISOString(),
    images,
    inputImages: effectiveInputImages,
  };
}

