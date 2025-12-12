import localforage from "localforage";
import type { Generation } from "./types";

const DB_NAME = "nano-banana-pro";
const STORE_NAME = "state";
const GENERATIONS_KEY = "seedream:generations";
const PENDING_KEY = "seedream:pending_generations";

// Initialize localforage
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

/**
 * Saves the generations metadata to storage.
 * Images are extracted, converted to Blobs, and stored individually.
 * The metadata contains references to these images.
 */
export async function persistGenerations(generations: Generation[]) {
  if (!store) return;

  const persistedGenerations = await Promise.all(
    generations.map(async (gen) => {
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
            
             // Similar logic for input images
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

      return {
        ...gen,
        images,
        thumbnails,
        inputImages
      };
    })
  );

  await store.setItem(GENERATIONS_KEY, persistedGenerations);
}

/**
 * Loads generations from storage.
 * Resolves references by loading Blobs and creating ObjectURLs.
 * Handles migration from old format (embedded data) to new format (references).
 */
export async function restoreGenerations(): Promise<Generation[] | null> {
  if (!store) return null;

  let storedData = await store.getItem<Generation[]>(GENERATIONS_KEY);

  // Try legacy location if not found
  if (!storedData && typeof window !== "undefined") {
      const legacy = window.localStorage.getItem(GENERATIONS_KEY);
      if (legacy) {
          try {
              storedData = JSON.parse(legacy);
              // Clear legacy
              window.localStorage.removeItem(GENERATIONS_KEY);
          } catch (e) {
              console.error("Failed to parse legacy generations", e);
          }
      }
  }

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
                    // Blob missing?
                    console.warn(`Missing blob for key ${key}`);
                    return "";
                }
            } catch (e) {
                console.error(`Failed to load blob ${key}`, e);
                return "";
            }
          } else if (img.startsWith("blob:")) {
            // Legacy bug: blob: URLs may have been persisted, but blob URLs are not stable across sessions.
            // Try to recover from the expected storage key.
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
            // It's NOT a reference (Old format migration)
            // Save it as blob immediately
            const key = getImageKey(gen.id, index, "output");
            try {
                const blob = await urlToBlob(img);
                await store!.setItem(key, blob);
                // We return the ObjectURL for display
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
      
      const hydratedGen = { ...gen, images, thumbnails, inputImages };

      // If we did migration on the fly, we should probably save the updated ref structure
      // BUT: calling persistGenerations here might be race-condition prone if the app is also saving.
      // Better to let the app state settle and save naturally, OR return a flag.
      // Since `restoreGenerations` is called on mount, and we set state, 
      // and `useEffect` watches state to save, it might trigger a save.
      // However, the state will contain ObjectURLs (blob:...), which `persistGenerations`
      // recognizes as "already saved" and converts to refs.
      // So the migration flow is:
      // 1. Load (Old Data) -> Convert to Blobs -> Save Blobs -> Return ObjectURLs.
      // 2. App sets state with ObjectURLs.
      // 3. App Effect triggers `persistGenerations`.
      // 4. `persistGenerations` sees ObjectURLs, assumes they are backed by DB (ref checks needed?).
      
      // WAIT. `persistGenerations` assumes `blob:` URL means "already in DB". 
      // In the migration case above, we DID put it in DB (`store.setItem`).
      // So when `persistGenerations` runs later, it will see `blob:` and return `ref:`.
      // This works perfectly.

      return hydratedGen;
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
    // Pending generations might also have images? 
    // Usually pending are "loading" state, but if they are retries, they have input images.
    // Logic is same as persistGenerations.
    // But we might want to store them separately or use the same logic.
    // Let's reuse the logic but save to PENDING_KEY.
    
    const persistedPending = await Promise.all(
        pending.map(async (gen) => {
            // Similar logic... reuse code?
            // Pending generations usually don't have output images yet (or placeholders).
            // But they have input images.
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
