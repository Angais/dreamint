"use client";

import {
  DEFAULT_GEMINI_MODEL_VARIANT,
  calculateImageSize,
  getAspectDefinition,
  getQualityDefinition,
  type AspectKey,
  type GeminiModelVariant,
  type QualityKey,
  type Provider,
  type OutputFormat,
} from "./seedream-options";

const MIN_IMAGE_DIMENSION = 512;
const MAX_IMAGE_DIMENSION = 4096;
// Gemini 3 Pro Image supports up to 14 reference images; keep the same cap here.
const MAX_MODEL_INPUT_IMAGES = 14;
// Gemini image gen can take up to ~3-4 minutes in some regions; use a generous timeout.
const DEFAULT_REQUEST_TIMEOUT_MS = 480_000;
const GEMINI_MODEL_ID_BY_VARIANT: Record<GeminiModelVariant, string> = {
  pro: "gemini-3-pro-image-preview",
  flash: "gemini-3.1-flash-image-preview",
};
const FAL_MODEL_PATH_BY_VARIANT: Record<GeminiModelVariant, string> = {
  pro: "fal-ai/gemini-3-pro-image-preview",
  flash: "fal-ai/gemini-3.1-flash-image-preview",
};

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
  modelVariant?: GeminiModelVariant;
  apiKey?: string; // FAL Key
  geminiApiKey?: string; // Gemini API key (Generative Language)
  sizeOverride?: { width: number; height: number };
  inputImages?: InputImage[];
  useGoogleSearch?: boolean;
  onThoughtsUpdate?: (imageIndex: number, thoughts: ImageThoughts) => void;
};

export type ImageThoughts = {
  text?: string[];
  images?: string[]; // Interim thought images (base64 data URLs)
};

export type SeedreamGeneration = {
  prompt: string;
  aspect: GenerateAspect;
  quality: QualityKey;
  outputFormat: OutputFormat;
  provider: Provider;
  modelVariant: GeminiModelVariant;
  useGoogleSearch?: boolean;
  createdAt: string;
  size: { width: number; height: number };
  images: string[];
  inputImages: InputImage[];
  thoughts?: (ImageThoughts | null)[]; // Chain of thought per image
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateSeedream({
  prompt,
  aspect,
  quality,
  outputFormat = "png",
  numImages = 4,
  provider,
  modelVariant = DEFAULT_GEMINI_MODEL_VARIANT,
  apiKey,
  geminiApiKey,
  sizeOverride,
  inputImages = [],
  useGoogleSearch = false,
  onThoughtsUpdate,
}: GenerateSeedreamArgs): Promise<SeedreamGeneration> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt is required.");
  }

  const validNumImages = Math.max(1, Math.min(4, Math.round(numImages)));
  const effectiveModelVariant =
    provider === "gemini" ? modelVariant : DEFAULT_GEMINI_MODEL_VARIANT;
  const isFlashModel = effectiveModelVariant === "flash";

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

  const deriveAspectRatioFromSize = (dimensions: { width: number; height: number }) => {
    const width = Math.max(1, Math.round(dimensions.width));
    const height = Math.max(1, Math.round(dimensions.height));
    let a = width;
    let b = height;

    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }

    const divisor = Math.max(1, a);
    const simplifiedWidth = Math.max(1, Math.round(width / divisor));
    const simplifiedHeight = Math.max(1, Math.round(height / divisor));
    return `${simplifiedWidth}:${simplifiedHeight}`;
  };

  const apiAspectRatio = aspectRatioMap[aspect] || deriveAspectRatioFromSize(size);
  const apiResolution = resolutionMap[quality] || "1K";

  const inlineImageParts = effectiveInputImages
    .map((img) => {
      if (!img.url.startsWith("data:")) {
        return null;
      }
      const [mimePart, base64Data] = img.url.split(",");
      const mimeType = mimePart.match(/:(.*?);/)?.[1] || "image/png";
      return {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };
    })
    .filter((item): item is { inlineData: { mimeType: string; data: string } } => Boolean(item));

  const baseContents = [
    {
      role: "user",
      parts: [{ text: trimmedPrompt }, ...inlineImageParts],
    },
  ];
  const effectiveGoogleSearch = provider === "gemini" && Boolean(useGoogleSearch);

  type ResponsePart = {
    text?: string;
    thought?: boolean | string;
    thought_signature?: string;
    thoughtSignature?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; mimeType?: string; data?: string };
  };

  const isThoughtPart = (part: ResponsePart): boolean => {
    if (typeof part?.thought === "string") {
      return part.thought.trim().toLowerCase() === "true";
    }
    return part?.thought === true;
  };

  const collectPartsFromPayload = (payload: unknown): ResponsePart[] => {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const root = payload as {
      parts?: ResponsePart[];
      content?: { parts?: ResponsePart[] };
      candidates?: Array<{ content?: { parts?: ResponsePart[] } }>;
    };

    const collected: ResponsePart[] = [];

    const appendParts = (parts: ResponsePart[] | undefined) => {
      if (Array.isArray(parts)) {
        collected.push(...parts);
      }
    };

    appendParts(root.parts);
    appendParts(root.content?.parts);
    for (const candidate of root.candidates ?? []) {
      appendParts(candidate?.content?.parts);
    }

    return collected;
  };

  const extractImageAndThoughts = (
    parts: ResponsePart[] | undefined,
  ): { image: string | null; thoughts: ImageThoughts | null } => {
    const thoughtTexts: string[] = [];
    const thoughtImages: string[] = [];
    const fallbackTexts: string[] = [];
    let finalImage: string | null = null;

    for (const part of parts ?? []) {
      const isThought = isThoughtPart(part);

      // Extract text from thought parts
      if (part?.text) {
        if (isThought) {
          thoughtTexts.push(part.text);
        } else {
          // Flash can return visible thinking text without thought=true;
          // keep it as a fallback so reasoning is not silently dropped.
          fallbackTexts.push(part.text);
        }
      }

      // Extract inline data (image)
      const inline =
        part?.inlineData ??
        (part?.inline_data
          ? {
              mimeType: part.inline_data.mime_type ?? part.inline_data.mimeType ?? "image/png",
              data: part.inline_data.data ?? "",
            }
          : undefined);

      const inlineData = inline?.data;
      const inlineMimeType = inline?.mimeType ?? "image/png";

      if (inlineData && inlineMimeType) {
        const dataUrl = `data:${inlineMimeType};base64,${inlineData}`;
        if (isThought) {
          thoughtImages.push(dataUrl);
        } else {
          // Non-thought image is the final output
          finalImage = dataUrl;
        }
      }
    }

    if (thoughtTexts.length === 0 && thoughtImages.length === 0 && fallbackTexts.length > 0) {
      thoughtTexts.push(...fallbackTexts);
    }

    const thoughts: ImageThoughts | null =
      thoughtTexts.length > 0 || thoughtImages.length > 0
        ? {
            text: thoughtTexts.length > 0 ? thoughtTexts : undefined,
            images: thoughtImages.length > 0 ? thoughtImages : undefined,
          }
        : null;

    return { image: finalImage, thoughts };
  };

  // --- FAL PROVIDER LOGIC ---
  if (provider === "fal") {
    const resolvedApiKey = (apiKey ?? "").trim();
    if (!resolvedApiKey) {
      throw new Error("Missing FAL API key. Add one in settings.");
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

    const falModelPath = FAL_MODEL_PATH_BY_VARIANT[effectiveModelVariant];
    const endpoint = useEditEndpoint
      ? `https://fal.run/${falModelPath}/edit`
      : `https://fal.run/${falModelPath}`;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${resolvedApiKey}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      DEFAULT_REQUEST_TIMEOUT_MS,
    );

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
      modelVariant: effectiveModelVariant,
      useGoogleSearch: effectiveGoogleSearch,
      createdAt: new Date().toISOString(),
      size,
      images,
      inputImages: effectiveInputImages,
    };
  }

  // --- GEMINI API (GENERATIVE LANGUAGE) LOGIC ---
  if (provider === "gemini") {
    const resolvedApiKey = (geminiApiKey ?? "").trim();

    if (!resolvedApiKey) {
      throw new Error("Missing Gemini API key. Add one in settings.");
    }

    const flashGroundedTools = [
      {
        google_search: {
          // Docs for 3.1 Flash image-search grounding use searchTypes/webSearch/imageSearch.
          searchTypes: { webSearch: {}, imageSearch: {} },
        },
      },
    ];
    const basePayload = {
      contents: baseContents,
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: apiAspectRatio,
          imageSize: apiResolution,
        },
        thinkingConfig: isFlashModel
          ? {
              thinkingLevel: "High",
              includeThoughts: true,
            }
          : {
              includeThoughts: true,
            },
      },
      ...(effectiveGoogleSearch
        ? { tools: isFlashModel ? flashGroundedTools : [{ google_search: {} }] }
        : {}),
    };

    const geminiModelId = GEMINI_MODEL_ID_BY_VARIANT[effectiveModelVariant];
    const streamEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}:streamGenerateContent?key=${encodeURIComponent(
      resolvedApiKey,
    )}&alt=sse`;
    const generateEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}:generateContent?key=${encodeURIComponent(
      resolvedApiKey,
    )}`;

    const throwGeminiApiError = (status: number, errorText: string): never => {
      try {
        const errJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errJson.error?.message) {
          const isUnavailable = status === 503;
          const suffix = isUnavailable ? " (service unavailable)" : "";
          throw new Error(
            `Gemini API Error${suffix}: ${errJson.error.message || "Request failed"}. Try again or switch provider.`,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Gemini API Error")) {
          throw error;
        }
      }

      if (status === 503) {
        throw new Error(
          "Gemini API is temporarily unavailable (503). Please retry shortly or switch to FAL.",
        );
      }

      throw new Error(`Gemini API Error (${status}): ${errorText}`);
    };

    const requests = Array.from({ length: validNumImages }).map(async (_, imageIndex) => {
      const payload = {
        ...basePayload,
        contents: basePayload.contents.map((content) => ({
          ...content,
          parts: content.parts.map((part) => ({ ...part })),
        })),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

      try {
        const requestInit: RequestInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": resolvedApiKey,
          },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: controller.signal,
        };

        let response = await fetch(streamEndpoint, requestInit);
        let useStreaming = true;

        // Flash can return thoughts via both endpoints. Prefer streaming for live CoT,
        // but fall back to generateContent if stream endpoint isn't available.
        if (isFlashModel && !response.ok) {
          const streamErrorText = await response.text();
          const streamErrorLower = streamErrorText.toLowerCase();
          const shouldFallbackToGenerate =
            response.status === 400 ||
            response.status === 404 ||
            response.status === 405 ||
            streamErrorLower.includes("streamgeneratecontent") ||
            streamErrorLower.includes("not found") ||
            streamErrorLower.includes("unsupported");

          if (shouldFallbackToGenerate) {
            response = await fetch(generateEndpoint, requestInit);
            useStreaming = false;
          } else {
            throwGeminiApiError(response.status, streamErrorText);
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          throwGeminiApiError(response.status, errorText);
        }

        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!useStreaming || !contentType.includes("text/event-stream")) {
          const json = (await response.json()) as unknown;
          const parts = collectPartsFromPayload(json);
          const result = extractImageAndThoughts(parts);
          if (onThoughtsUpdate && result.thoughts) {
            onThoughtsUpdate(imageIndex, result.thoughts);
          }
          return result;
        }

        // Parse SSE stream
        const allParts: ResponsePart[] = [];
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonStr = line.slice(5).trimStart();
              if (jsonStr.trim() === "[DONE]") continue;

              try {
                const chunk = JSON.parse(jsonStr) as unknown;
                const parts = collectPartsFromPayload(chunk);
                allParts.push(...parts);

                // Call the callback with accumulated thoughts so far
                if (onThoughtsUpdate) {
                  const currentResult = extractImageAndThoughts(allParts);
                  if (currentResult.thoughts) {
                    onThoughtsUpdate(imageIndex, currentResult.thoughts);
                  }
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }

        return extractImageAndThoughts(allParts);
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const results = await Promise.all(
      requests.map((req) =>
        req.catch((error) => {
          throw new Error(
            error instanceof Error && error.name === "AbortError"
              ? "Gemini API request timed out. Check your connection and try again."
              : error instanceof Error
              ? error.message
              : "Gemini API request failed.",
          );
        }),
      ),
    );

    type ImageResult = { image: string | null; thoughts: ImageThoughts | null };
    const validResults = results.filter(
      (r): r is ImageResult => r !== null && typeof r === "object" && typeof r.image === "string" && r.image.length > 0,
    );

    if (validResults.length === 0) {
      throw new Error("No images returned from Gemini API.");
    }

    const images = validResults.map((r) => r.image as string);
    const thoughts = validResults.map((r) => r.thoughts);

    return {
      prompt: trimmedPrompt,
      aspect,
      quality,
      outputFormat,
      provider,
      modelVariant: effectiveModelVariant,
      useGoogleSearch: effectiveGoogleSearch,
      createdAt: new Date().toISOString(),
      size,
      images,
      inputImages: effectiveInputImages,
      thoughts,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}
