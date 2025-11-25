"use server";

import "server-only";

import {
  calculateImageSize,
  getAspectDefinition,
  getQualityDefinition,
  type AspectKey,
  type QualityKey,
  type Provider,
  type OutputFormat,
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
  outputFormat?: OutputFormat;
  numImages?: number;
  provider: Provider;
  apiKey?: string; // FAL Key
  vertexApiKey?: string; // Google/Vertex Key
  vertexProjectId?: string; // Google Cloud Project ID
  sizeOverride?: { width: number; height: number };
  inputImages?: InputImage[];
};

export type SeedreamGeneration = {
  prompt: string;
  aspect: GenerateAspect;
  quality: QualityKey;
  outputFormat: OutputFormat;
  provider: Provider;
  createdAt: string;
  size: { width: number; height: number };
  images: string[];
  inputImages: InputImage[];
};

export async function generateSeedream({
  prompt,
  aspect,
  quality,
  outputFormat = "png",
  numImages = 4,
  provider,
  apiKey,
  vertexApiKey,
  vertexProjectId,
  sizeOverride,
  inputImages = [],
}: GenerateSeedreamArgs): Promise<SeedreamGeneration> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt is required.");
  }

  const validNumImages = Math.max(1, Math.min(4, Math.round(numImages)));

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

  const aspectRatioMap: Record<string, string> = {
    "square-1-1": "1:1",
    "portrait-2-3": "2:3",
    "portrait-3-4": "3:4",
    "portrait-4-5": "4:5",
    "portrait-9-16": "9:16",
    "landscape-3-2": "3:2",
    "landscape-4-3": "4:3",
    "landscape-5-4": "5:4",
    "landscape-16-9": "16:9",
    "landscape-21-9": "21:9",
  };

  const resolutionMap: Record<string, string> = {
    "1k": "1K",
    "2k": "2K",
    "4k": "4K",
  };

  const apiAspectRatio = aspectRatioMap[aspect] || "1:1";
  const apiResolution = resolutionMap[quality] || "1K";

  // --- FAL PROVIDER LOGIC ---
  if (provider === "fal") {
    const resolvedApiKey = (apiKey ?? "").trim() || process.env.FAL_API_KEY;
    if (!resolvedApiKey) {
      throw new Error("Missing FAL API key. Add one in settings or set FAL_API_KEY.");
    }

    const payload: Record<string, unknown> = {
      prompt: trimmedPrompt,
      aspect_ratio: apiAspectRatio,
      resolution: apiResolution,
      num_images: validNumImages,
      sync_mode: true,
      enable_safety_checker: false,
      output_format: outputFormat,
    };

    if (useEditEndpoint) {
      // FAL Edit endpoint might handle batch size differently or same, assuming same
      const requestedOutputs = validNumImages;
      if (effectiveInputImages.length + requestedOutputs > 15) {
        throw new Error("Total number of images (input + output) must not exceed 15.");
      }
      payload.image_urls = effectiveInputImages.map((image) => image.url);
    }

    const endpoint = useEditEndpoint
      ? "https://fal.run/fal-ai/gemini-3-pro-image-preview/edit"
      : "https://fal.run/fal-ai/gemini-3-pro-image-preview";

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
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as {
      images?: { url?: string }[];
    };

    const images = (json.images ?? [])
      .map((item) => item?.url)
      .filter((url): url is string => typeof url === "string" && url.length > 0);

    if (images.length === 0) {
      throw new Error("No images returned.");
    }

    return {
      prompt: trimmedPrompt,
      aspect,
      quality,
      outputFormat,
      provider,
      createdAt: new Date().toISOString(),
      size,
      images,
      inputImages: effectiveInputImages,
    };
  }

  // --- GOOGLE/VERTEX PROVIDER LOGIC ---
  if (provider === "google") {
    const resolvedApiKey = (vertexApiKey ?? "").trim() || process.env.GOOGLE_API_KEY;
    if (!resolvedApiKey) {
      throw new Error("Missing Google/Vertex API key.");
    }

    // For Vertex AI (including Express Mode), Project ID is required to construct the URL
    if (!vertexProjectId) {
      throw new Error("Google Cloud Project ID is required for Vertex AI.");
    }

    // Prepare concurrent requests
    const requests = Array.from({ length: validNumImages }).map(async () => {
      // Vertex AI Endpoint (Global)
      const endpoint = `https://aiplatform.googleapis.com/v1/projects/${vertexProjectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent?key=${resolvedApiKey}`;
      
      const payload: Record<string, unknown> = {
        contents: [
          {
            role: "user",
            parts: [{ text: trimmedPrompt }]
          }
        ],
        generation_config: {
          response_modalities: ["TEXT", "IMAGE"],
          image_config: {
             aspect_ratio: apiAspectRatio,
             image_size: apiResolution,
          },
        }
      };

      // Handle input images for "edit" or multimodal prompt
      // Note: Gemini 3 Pro Image Preview might support input images in the `parts` array.
      if (effectiveInputImages.length > 0) {
        const contents = payload.contents as Array<{ parts: Array<Record<string, unknown>> }>;
        const parts = contents[0].parts;
        effectiveInputImages.forEach((img) => {
          if (img.url.startsWith("data:")) {
            const [mimePart, base64Data] = img.url.split(",");
            const mimeType = mimePart.match(/:(.*?);/)?.[1] || "image/png";
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        });
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Try to parse error for better message
        try {
           const errJson = JSON.parse(errorText) as { error?: { message?: string; code?: number; status?: string } };
           if (errJson.error?.message) {
             throw new Error(`Google API Error: ${errJson.error.message}`);
           }
        } catch(e) { 
          if (e instanceof Error && e.message.startsWith("Google API Error")) throw e;
        }
        throw new Error(`Google API Error (${response.status}): ${errorText}`);
      }

      const json = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: {
              inlineData?: {
                mimeType: string;
                data: string;
              };
            }[];
          };
        }[];
      };
      
      const candidate = json.candidates?.[0];
      if (!candidate) return null;
      
      const part = candidate.content?.parts?.find((p) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      return null;
    });

    const results = await Promise.all(requests);
    const images = results.filter((img): img is string => typeof img === "string");

    if (images.length === 0) {
      throw new Error("No images returned from Google API.");
    }

    return {
      prompt: trimmedPrompt,
      aspect,
      quality,
      outputFormat,
      provider,
      createdAt: new Date().toISOString(),
      size,
      images,
      inputImages: effectiveInputImages,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}
