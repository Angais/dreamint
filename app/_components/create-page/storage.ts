import localforage from "localforage";
import { LEGACY_ASPECT_RATIO_BY_KEY } from "../../lib/image-options";
import type { Generation } from "./types";

const DB_NAME = "dreamint";
const STORE_NAME = "state";
const GENERATIONS_KEY = "dreamint:generations";
const PENDING_KEY = "dreamint:pending_generations";

// Pre-OpenRouter storage locations, migrated on first load.
const LEGACY_DB_NAME = "nano-banana-pro";
const LEGACY_GENERATIONS_KEY = "seedream:generations";
const LEGACY_PENDING_KEY = "seedream:pending_generations";

type PersistedGenerationCacheEntry = {
  source: Generation;
  persisted: Generation;
};

const persistedGenerationCache = new Map<string, PersistedGenerationCacheEntry>();

const store = typeof window !== "undefined"
  ? localforage.createInstance({
      name: DB_NAME,
      storeName: STORE_NAME,
      description: "Dreamint gallery cache",
    })
  : null;

// Helper to generate a unique key for an image
function getImageKey(generationId: string, index: number, type: "output" | "input" = "output", inputId?: string): string {
  if (type === "input" && inputId) {
    return `img:${generationId}:input:${inputId}`;
  }
  return `img:${generationId}:${index}`;
}

function getThumbnailKey(generationId: string, index: number): string {
  return `thumb:${generationId}:${index}`;
}

// Helper to check if a string is a reference key
function isRef(str: string): boolean {
  return str.startsWith("ref:");
}

function getRefKey(str: string): string {
  return str.replace("ref:", "");
}

function makeRef(key: string): string {
  return `ref:${key}`;
}

export function isStoredAssetRef(value: string): boolean {
  return isRef(value);
}

type LegacyUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  inputTextTokens?: number | null;
  inputImageTokens?: number | null;
  cachedTextTokens?: number | null;
  cachedImageTokens?: number | null;
};

type LegacyGeneration = {
  id: string;
  prompt: string;
  aspect?: string;
  aspectSelection?: string;
  quality?: string;
  outputFormat?: string;
  provider?: string;
  modelVariant?: string;
  openAIModel?: string;
  openAIQuality?: string;
  createdAt: string;
  size?: { width: number; height: number };
  images?: string[];
  thumbnails?: string[];
  deletedImages?: number[];
  inputImages?: Generation["inputImages"];
  durationMs?: number;
  estimatedOpenAICost?: { totalCostUsd?: number };
  openAIUsage?: LegacyUsage | null;
};

const LEGACY_RESOLUTION_BY_QUALITY: Record<string, string> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

// gpt-image-2 pricing, kept only to preserve actual costs of pre-OpenRouter records.
const LEGACY_GPT_IMAGE_2_PRICING = {
  textInputPerMillion: 5,
  textCachedInputPerMillion: 1.25,
  imageInputPerMillion: 8,
  imageCachedInputPerMillion: 2,
  imageOutputPerMillion: 30,
};

function legacyActualCostUsd(usage: LegacyUsage | null | undefined): number | null {
  if (!usage) {
    return null;
  }

  const cachedTextTokens = usage.cachedTextTokens ?? 0;
  const cachedImageTokens = usage.cachedImageTokens ?? 0;
  if (
    typeof usage.inputTextTokens !== "number" ||
    typeof usage.inputImageTokens !== "number" ||
    typeof usage.outputTokens !== "number"
  ) {
    return null;
  }

  const nonCachedTextTokens = Math.max(0, usage.inputTextTokens - cachedTextTokens);
  const nonCachedImageTokens = Math.max(0, usage.inputImageTokens - cachedImageTokens);
  const inputCostUsd =
    (nonCachedTextTokens / 1_000_000) * LEGACY_GPT_IMAGE_2_PRICING.textInputPerMillion +
    (cachedTextTokens / 1_000_000) * LEGACY_GPT_IMAGE_2_PRICING.textCachedInputPerMillion +
    (nonCachedImageTokens / 1_000_000) * LEGACY_GPT_IMAGE_2_PRICING.imageInputPerMillion +
    (cachedImageTokens / 1_000_000) * LEGACY_GPT_IMAGE_2_PRICING.imageCachedInputPerMillion;
  const outputCostUsd =
    (usage.outputTokens / 1_000_000) * LEGACY_GPT_IMAGE_2_PRICING.imageOutputPerMillion;

  return inputCostUsd + outputCostUsd;
}

function deriveLegacyAspectRatio(record: LegacyGeneration): string {
  if (record.aspect && LEGACY_ASPECT_RATIO_BY_KEY[record.aspect]) {
    return LEGACY_ASPECT_RATIO_BY_KEY[record.aspect];
  }

  const width = Math.max(1, Math.round(record.size?.width ?? 1));
  const height = Math.max(1, Math.round(record.size?.height ?? 1));
  let a = width;
  let b = height;
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  const divisor = Math.max(1, a);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function migrateLegacyGeneration(record: LegacyGeneration): Generation {
  const maybeMigrated = record as unknown as Generation;
  if (typeof maybeMigrated.model === "string" && typeof maybeMigrated.aspectRatio === "string") {
    return maybeMigrated;
  }

  const isFlash = record.modelVariant === "flash";
  const model =
    record.provider === "openai"
      ? `openai/${record.openAIModel ?? "gpt-image-2"}`
      : isFlash
        ? "google/gemini-3.1-flash-image-preview"
        : "google/gemini-3-pro-image-preview";
  const modelLabel =
    record.provider === "openai"
      ? record.openAIModel ?? "gpt-image-2"
      : isFlash
        ? "Gemini 3.1 Flash Image"
        : "Gemini 3 Pro Image";
  const costUsd =
    legacyActualCostUsd(record.openAIUsage) ??
    (typeof record.estimatedOpenAICost?.totalCostUsd === "number"
      ? record.estimatedOpenAICost.totalCostUsd
      : null);
  const outputFormat =
    record.outputFormat === "jpeg" || record.outputFormat === "webp" ? record.outputFormat : "png";

  return {
    id: record.id,
    prompt: record.prompt,
    model,
    modelLabel,
    aspectRatio: deriveLegacyAspectRatio(record),
    resolution: record.quality ? LEGACY_RESOLUTION_BY_QUALITY[record.quality] ?? null : null,
    quality: record.openAIQuality ?? null,
    outputFormat,
    createdAt: record.createdAt,
    size: record.size ?? { width: 1024, height: 1024 },
    images: record.images ?? [],
    thumbnails: record.thumbnails,
    deletedImages: record.deletedImages,
    inputImages: record.inputImages ?? [],
    durationMs: record.durationMs,
    usage:
      costUsd !== null || record.openAIUsage
        ? {
            promptTokens: record.openAIUsage?.inputTokens ?? null,
            completionTokens: record.openAIUsage?.outputTokens ?? null,
            totalTokens: record.openAIUsage?.totalTokens ?? null,
            costUsd,
            upstreamCostUsd: null,
          }
        : null,
  };
}

let legacyMigrationPromise: Promise<void> | null = null;

async function migrateLegacyStore(): Promise<void> {
  if (!store || typeof window === "undefined") {
    return;
  }

  const existingGenerations = await store.getItem(GENERATIONS_KEY);
  if (existingGenerations !== null) {
    return;
  }

  const legacyStore = localforage.createInstance({
    name: LEGACY_DB_NAME,
    storeName: STORE_NAME,
  });

  try {
    const [legacyGenerations, legacyPending] = await Promise.all([
      legacyStore.getItem<LegacyGeneration[]>(LEGACY_GENERATIONS_KEY),
      legacyStore.getItem<LegacyGeneration[]>(LEGACY_PENDING_KEY),
    ]);

    const hasLegacyData =
      (Array.isArray(legacyGenerations) && legacyGenerations.length > 0) ||
      (Array.isArray(legacyPending) && legacyPending.length > 0);
    if (!hasLegacyData) {
      return;
    }

    const legacyKeys = await legacyStore.keys();
    for (const key of legacyKeys) {
      if (!key.startsWith("img:") && !key.startsWith("thumb:")) {
        continue;
      }

      const blob = await legacyStore.getItem<Blob>(key);
      if (blob) {
        await store.setItem(key, blob);
      }
    }

    if (Array.isArray(legacyGenerations) && legacyGenerations.length > 0) {
      await store.setItem(GENERATIONS_KEY, legacyGenerations.map(migrateLegacyGeneration));
    }
    if (Array.isArray(legacyPending) && legacyPending.length > 0) {
      await store.setItem(PENDING_KEY, legacyPending.map(migrateLegacyGeneration));
    }

    await localforage.dropInstance({ name: LEGACY_DB_NAME });
  } catch (error) {
    console.error("Legacy storage migration failed", error);
  }
}

function ensureLegacyMigration(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyStore();
  }
  return legacyMigrationPromise;
}

export async function resolveStoredAssetBlob(value: string): Promise<Blob | null> {
  if (!store || !isRef(value)) {
    return null;
  }

  try {
    return (await store.getItem<Blob>(getRefKey(value))) ?? null;
  } catch (error) {
    console.error("Failed to resolve stored asset blob", error);
    return null;
  }
}

export async function resolveAssetBlob(value: string): Promise<Blob | null> {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source) {
    return null;
  }

  if (isRef(source)) {
    return resolveStoredAssetBlob(source);
  }

  try {
    const response = await fetch(source);
    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error("Failed to resolve asset blob", error);
    return null;
  }
}

export async function resolveStoredAssetUrl(value: string): Promise<string> {
  if (!isRef(value)) {
    return value;
  }

  const blob = await resolveStoredAssetBlob(value);
  return blob ? URL.createObjectURL(blob) : "";
}

async function removeGenerationAssets(generation: Generation) {
  if (!store) return;

  const removals: Promise<unknown>[] = [];

  generation.images.forEach((img, index) => {
    const outputKey = img
      ? isRef(img)
        ? getRefKey(img)
        : getImageKey(generation.id, index, "output")
      : getImageKey(generation.id, index, "output");
    removals.push(store.removeItem(outputKey));

    const thumb = generation.thumbnails?.[index];
    const thumbKey = thumb
      ? isRef(thumb)
        ? getRefKey(thumb)
        : getThumbnailKey(generation.id, index)
      : getThumbnailKey(generation.id, index);
    removals.push(store.removeItem(thumbKey));
  });

  (generation.inputImages || []).forEach((img) => {
    if (!img.url) return;
    const key = isRef(img.url)
      ? getRefKey(img.url)
      : getImageKey(generation.id, 0, "input", img.id);
    removals.push(store.removeItem(key));
  });

  await Promise.allSettled(removals);
}

async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.blob();
}

const MIN_THUMB_DIMENSION = 1024;

async function getBlobDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);
      image.decoding = "async";
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to decode image"));
      };
      image.src = objectUrl;
    });

    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

async function createThumbnailBlob(blob: Blob, maxSize = MIN_THUMB_DIMENSION): Promise<Blob | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    let srcWidth = 0;
    let srcHeight = 0;
    let source: CanvasImageSource | null = null;
    let bitmapToClose: ImageBitmap | null = null;

    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(blob);
      bitmapToClose = bitmap;
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
      source = bitmap;
    } else {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(blob);
        image.decoding = "async";
        image.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Failed to decode image"));
        };
        image.src = objectUrl;
      });
      srcWidth = img.naturalWidth;
      srcHeight = img.naturalHeight;
      source = img;
    }

    if (!source || !srcWidth || !srcHeight) {
      return null;
    }

    const scale = Math.min(1, maxSize / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    bitmapToClose?.close();

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
  } catch (error) {
    console.error("Failed to create thumbnail", error);
    return null;
  }
}

export async function cacheGenerationAssets(generation: Generation): Promise<Generation> {
  if (!store) {
    return generation;
  }

  const outputResults = await Promise.all(
    generation.images.map(async (image, index) => {
      if (!image) {
        return { image: "", thumbnail: "" };
      }

      if (isRef(image)) {
        const existingThumb = generation.thumbnails?.[index] ?? "";
        return {
          image,
          thumbnail: existingThumb && isRef(existingThumb) ? existingThumb : existingThumb,
        };
      }

      const imageKey = getImageKey(generation.id, index, "output");
      const thumbnailKey = getThumbnailKey(generation.id, index);

      try {
        const blob = await urlToBlob(image);
        await store.setItem(imageKey, blob);

        const thumbnailBlob = await createThumbnailBlob(blob);
        if (thumbnailBlob) {
          await store.setItem(thumbnailKey, thumbnailBlob);
        }

        return {
          image: makeRef(imageKey),
          thumbnail: thumbnailBlob ? makeRef(thumbnailKey) : "",
        };
      } catch (error) {
        console.error(`Failed to cache generation image ${imageKey}`, error);
        return {
          image,
          thumbnail: generation.thumbnails?.[index] ?? "",
        };
      }
    }),
  );

  const inputImages = await Promise.all(
    (generation.inputImages || []).map(async (image) => {
      if (!image.url || isRef(image.url)) {
        return image;
      }

      const inputKey = getImageKey(generation.id, 0, "input", image.id);

      try {
        const blob = await urlToBlob(image.url);
        await store.setItem(inputKey, blob);
        return { ...image, url: makeRef(inputKey) };
      } catch (error) {
        console.error(`Failed to cache input image ${inputKey}`, error);
        return image;
      }
    }),
  );

  return {
    ...generation,
    images: outputResults.map((result) => result.image),
    thumbnails: outputResults.map((result) => result.thumbnail),
    inputImages,
  };
}

/**
 * Saves the generations metadata to storage.
 * Images are extracted, converted to Blobs, and stored individually.
 * The metadata contains references to these images.
 */
export async function persistGenerations(generations: Generation[]) {
  if (!store) return;

  const currentGenerationIds = new Set(generations.map((generation) => generation.id));
  persistedGenerationCache.forEach((_, generationId) => {
    if (!currentGenerationIds.has(generationId)) {
      persistedGenerationCache.delete(generationId);
    }
  });

  const persistedGenerations = await Promise.all(
    generations.map(async (gen) => {
      const cached = persistedGenerationCache.get(gen.id);
      if (cached?.source === gen) {
        return cached.persisted;
      }

      // Handle Output Images
      const outputResults: Array<{ image: string; thumbnail: string }> = [];

      for (let index = 0; index < gen.images.length; index += 1) {
        const img = gen.images[index];

        if (!img) {
          outputResults.push({ image: "", thumbnail: "" });
          continue;
        }

        if (isRef(img)) {
          const existingThumb = gen.thumbnails?.[index];
          outputResults.push({
            image: img,
            thumbnail: existingThumb && isRef(existingThumb) ? existingThumb : existingThumb ?? "",
          });
          continue;
        }

        const key = getImageKey(gen.id, index, "output");
        const thumbKey = getThumbnailKey(gen.id, index);
        const existingThumb = gen.thumbnails?.[index];

        if (img.startsWith("blob:")) {
          if (!existingThumb || isRef(existingThumb)) {
            try {
              const blob = await urlToBlob(img);
              const thumbnailBlob = await createThumbnailBlob(blob);
              if (thumbnailBlob) {
                await store.setItem(thumbKey, thumbnailBlob);
              }
            } catch (error) {
              console.error(`Failed to generate thumbnail ${thumbKey}`, error);
            }
          }

          outputResults.push({ image: makeRef(key), thumbnail: makeRef(thumbKey) });
          await new Promise((resolve) => setTimeout(resolve, 0));
          continue;
        }

        try {
          const blob = await urlToBlob(img);
          await store.setItem(key, blob);
          const thumbnailBlob = await createThumbnailBlob(blob);
          if (thumbnailBlob) {
            await store.setItem(thumbKey, thumbnailBlob);
          }
          outputResults.push({ image: makeRef(key), thumbnail: makeRef(thumbKey) });
        } catch (e) {
          console.error(`Failed to save image ${key}`, e);
          outputResults.push({ image: img, thumbnail: existingThumb ?? "" });
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const images = outputResults.map((result) => result.image);
      const thumbnails = outputResults.map((result) => result.thumbnail);

      // Handle Input Images (References)
      const inputImages = await Promise.all(
        (gen.inputImages || []).map(async (img) => {
          if (!img.url) return img;
          if (isRef(img.url)) return img;

          const key = getImageKey(gen.id, 0, "input", img.id); // index 0 unused for input

          if (img.url.startsWith("blob:")) {
            return { ...img, url: makeRef(key) };
          }

          try {
            const blob = await urlToBlob(img.url);
            await store.setItem(key, blob);
            return { ...img, url: makeRef(key) };
          } catch (e) {
            console.error(`Failed to save input image ${key}`, e);
            return img;
          }
        })
      );

      const persistedGeneration = {
        ...gen,
        images,
        thumbnails,
        inputImages
      };

      persistedGenerationCache.set(gen.id, {
        source: gen,
        persisted: persistedGeneration,
      });

      return persistedGeneration;
    })
  );

  await store.setItem(GENERATIONS_KEY, persistedGenerations);
}

/**
 * Loads generations from storage.
 * Resolves references by loading Blobs and creating ObjectURLs.
 * Migrates the pre-OpenRouter database and record shape on first load.
 */
export async function restoreGenerations(): Promise<Generation[] | null> {
  if (!store) return null;

  await ensureLegacyMigration();

  const storedData = await store.getItem<Generation[]>(GENERATIONS_KEY);

  if (!Array.isArray(storedData)) return null;

  const hydratedGenerations = await Promise.all(
    storedData.map(async (gen) => {
      // Hydrate Output Images
      const images = await Promise.all(
        gen.images.map(async (img, index) => {
          if (!img) return "";

          if (isRef(img)) {
            // It's a reference, load the blob
            const key = getRefKey(img);
            try {
              const blob = await store!.getItem<Blob>(key);
              if (blob) {
                return URL.createObjectURL(blob);
              } else {
                console.warn(`Missing blob for key ${key}`);
                return "";
              }
            } catch (e) {
              console.error(`Failed to load blob ${key}`, e);
              return "";
            }
          } else if (img.startsWith("blob:")) {
            // blob: URLs are not stable across sessions; recover from the expected storage key.
            const key = getImageKey(gen.id, index, "output");
            try {
              const blob = await store!.getItem<Blob>(key);
              if (blob) {
                return URL.createObjectURL(blob);
              }
              return "";
            } catch (e) {
              console.error(`Failed to recover blob URL for ${key}`, e);
              return "";
            }
          } else {
            // Old format with embedded data: save it as a blob and hand back an ObjectURL.
            const key = getImageKey(gen.id, index, "output");
            try {
              const blob = await urlToBlob(img);
              await store!.setItem(key, blob);
              return URL.createObjectURL(blob);
            } catch (e) {
              console.error(`Failed to migrate image ${key}`, e);
              return img;
            }
          }
        })
      );

      // Hydrate Input Images
      const inputImages = await Promise.all(
        (gen.inputImages || []).map(async (inputImg) => {
          if (!inputImg.url) return inputImg;

          if (isRef(inputImg.url)) {
            const key = getRefKey(inputImg.url);
            try {
              const blob = await store!.getItem<Blob>(key);
              if (blob) {
                return { ...inputImg, url: URL.createObjectURL(blob) };
              }
              return { ...inputImg, url: "" };
            } catch {
              return inputImg;
            }
          } else if (inputImg.url.startsWith("blob:")) {
            const key = getImageKey(gen.id, 0, "input", inputImg.id);
            try {
              const blob = await store!.getItem<Blob>(key);
              return blob ? { ...inputImg, url: URL.createObjectURL(blob) } : { ...inputImg, url: "" };
            } catch {
              return { ...inputImg, url: "" };
            }
          } else {
            // Migration
            const key = getImageKey(gen.id, 0, "input", inputImg.id);
            try {
              const blob = await urlToBlob(inputImg.url);
              await store!.setItem(key, blob);
              return { ...inputImg, url: URL.createObjectURL(blob) };
            } catch {
              return inputImg;
            }
          }
        })
      );

      const storedThumbs = Array.isArray(gen.thumbnails) ? gen.thumbnails : [];
      const thumbnails: string[] = [];

      for (let index = 0; index < gen.images.length; index += 1) {
        const img = gen.images[index];
        const thumbValue = storedThumbs[index];
        const thumbKey = getThumbnailKey(gen.id, index);

        if (thumbValue) {
          if (isRef(thumbValue)) {
            const key = getRefKey(thumbValue);
            try {
              const blob = await store!.getItem<Blob>(key);
              if (blob) {
                const dims = await getBlobDimensions(blob);
                if (dims && Math.max(dims.width, dims.height) < MIN_THUMB_DIMENSION) {
                  const outputKey = isRef(img)
                    ? getRefKey(img)
                    : getImageKey(gen.id, index, "output");
                  const outputBlob = await store!.getItem<Blob>(outputKey);
                  const upgraded = outputBlob
                    ? await createThumbnailBlob(outputBlob, MIN_THUMB_DIMENSION)
                    : null;
                  if (upgraded) {
                    await store!.setItem(thumbKey, upgraded);
                    thumbnails.push(URL.createObjectURL(upgraded));
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    continue;
                  }
                }

                thumbnails.push(URL.createObjectURL(blob));
              } else {
                thumbnails.push("");
              }
            } catch {
              thumbnails.push("");
            }
            continue;
          }

          if (thumbValue.startsWith("blob:")) {
            // Same as output images: blob URLs are not stable across sessions.
            try {
              const blob = await store!.getItem<Blob>(thumbKey);
              thumbnails.push(blob ? URL.createObjectURL(blob) : "");
            } catch {
              thumbnails.push("");
            }
            continue;
          }
        }

        const outputKey = isRef(img) ? getRefKey(img) : getImageKey(gen.id, index, "output");
        try {
          const outputBlob = await store!.getItem<Blob>(outputKey);
          if (!outputBlob) {
            thumbnails.push("");
            continue;
          }
          const thumbBlob = await createThumbnailBlob(outputBlob);
          if (!thumbBlob) {
            thumbnails.push("");
            continue;
          }
          await store!.setItem(thumbKey, thumbBlob);
          thumbnails.push(URL.createObjectURL(thumbBlob));
        } catch {
          thumbnails.push("");
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return { ...gen, images, thumbnails, inputImages };
    })
  );

  return hydratedGenerations;
}

export async function clearPending() {
  if (!store) return;
  await store.removeItem(PENDING_KEY);
}

export async function savePending(pending: Generation[]) {
  if (!store) return;
  // Pending generations have no outputs yet, but their input images need
  // the same blob handling as persisted generations.
  const persistedPending = await Promise.all(
    pending.map(async (gen) => {
      const inputImages = await Promise.all(
        (gen.inputImages || []).map(async (img) => {
          if (!img.url) return img;
          if (isRef(img.url)) return img;
          const key = getImageKey(gen.id, 0, "input", img.id);
          if (img.url.startsWith("blob:")) return { ...img, url: makeRef(key) };

          try {
            const blob = await urlToBlob(img.url);
            await store!.setItem(key, blob);
            return { ...img, url: makeRef(key) };
          } catch {
            return img;
          }
        })
      );
      return { ...gen, inputImages };
    })
  );

  await store.setItem(PENDING_KEY, persistedPending);
}

export async function loadPending(): Promise<Generation[]> {
  if (!store) return [];

  await ensureLegacyMigration();

  const stored = await store.getItem<Generation[]>(PENDING_KEY);
  if (!Array.isArray(stored)) return [];

  // Hydrate
  return Promise.all(stored.map(async (gen) => {
    const inputImages = await Promise.all(
      (gen.inputImages || []).map(async (img) => {
        if (isRef(img.url)) {
          const key = getRefKey(img.url);
          const blob = await store!.getItem<Blob>(key);
          return blob ? { ...img, url: URL.createObjectURL(blob) } : img;
        }
        return img;
      })
    );
    return { ...gen, inputImages };
  }));
}

export async function deleteGenerationData(generationId: string, generation?: Generation) {
  if (!store) return;
  persistedGenerationCache.delete(generationId);

  const [storedGenerations, storedPending] = await Promise.all([
    store.getItem<Generation[]>(GENERATIONS_KEY),
    store.getItem<Generation[]>(PENDING_KEY),
  ]);

  const resolvedGeneration =
    generation ??
    storedGenerations?.find((gen) => gen.id === generationId) ??
    storedPending?.find((gen) => gen.id === generationId);

  if (resolvedGeneration) {
    await removeGenerationAssets(resolvedGeneration);
  }

  const nextGenerations = Array.isArray(storedGenerations)
    ? storedGenerations.filter((gen) => gen.id !== generationId)
    : storedGenerations;
  const nextPending = Array.isArray(storedPending)
    ? storedPending.filter((gen) => gen.id !== generationId)
    : storedPending;

  const writes: Promise<unknown>[] = [];
  if (Array.isArray(nextGenerations)) {
    writes.push(store.setItem(GENERATIONS_KEY, nextGenerations));
  }
  if (Array.isArray(nextPending)) {
    writes.push(store.setItem(PENDING_KEY, nextPending));
  }

  await Promise.allSettled(writes);
}

export async function deleteOutputImageData(generationId: string, imageIndex: number) {
  if (!store) return;
  persistedGenerationCache.delete(generationId);
  const key = getImageKey(generationId, imageIndex, "output");
  const thumbKey = getThumbnailKey(generationId, imageIndex);
  await Promise.allSettled([store.removeItem(key), store.removeItem(thumbKey)]);
}

export async function cleanOrphanedImages(
  generations?: Generation[] | null,
  pending?: Generation[] | null,
) {
  if (!store) return;

  const [storedGenerations, storedPending] = await Promise.all([
    generations ?? store.getItem<Generation[]>(GENERATIONS_KEY),
    pending ?? store.getItem<Generation[]>(PENDING_KEY),
  ]);

  const referencedKeys = new Set<string>();
  const collectKeys = (gen: Generation) => {
    gen.images.forEach((img, index) => {
      if (!img) return;
      const key = isRef(img) ? getRefKey(img) : getImageKey(gen.id, index, "output");
      referencedKeys.add(key);

      const thumbRef = gen.thumbnails?.[index];
      const thumbKey = thumbRef
        ? isRef(thumbRef)
          ? getRefKey(thumbRef)
          : getThumbnailKey(gen.id, index)
        : getThumbnailKey(gen.id, index);
      referencedKeys.add(thumbKey);
    });
    (gen.inputImages || []).forEach((img) => {
      if (!img.url) return;
      const key = isRef(img.url) ? getRefKey(img.url) : getImageKey(gen.id, 0, "input", img.id);
      referencedKeys.add(key);
    });
  };

  (storedGenerations ?? []).forEach(collectKeys);
  (storedPending ?? []).forEach(collectKeys);

  const keys = await store.keys();
  const removals = keys
    .filter(
      (key) =>
        (key.startsWith("img:") || key.startsWith("thumb:")) && !referencedKeys.has(key),
    )
    .map((key) => store.removeItem(key));

  if (removals.length === 0) return;
  await Promise.allSettled(removals);
}
