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

// Helper to check if a string is a reference key
function isRef(str: string): boolean {
  return str.startsWith("ref:img:");
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
    if (!img) return;
    const key = isRef(img) ? getRefKey(img) : getImageKey(generation.id, index, "output");
    removals.push(store.removeItem(key));
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
      const images = await Promise.all(
        gen.images.map(async (img, index) => {
          if (!img) return "";
          
          // If it's already a reference (shouldn't happen in app state ideally, but for safety)
          if (isRef(img)) return img;

          const key = getImageKey(gen.id, index, "output");

          // If it's a blob URL, it means we likely loaded it from storage previously.
          // We assume the data is already in storage under 'key'.
          // However, to be safe against "new" blob URLs (created this session but not loaded from storage),
          // we could check if the key exists. 
          // Optimization: Assume blob: URLs correspond to existing keys if they were loaded.
          // BUT: New generations created in this session might use blob URLs (if we changed that logic)
          // OR: New generations come as data/http URLs.
          
          if (img.startsWith("blob:")) {
            // It's a blob URL. We assume it is backed by storage.
            // If we wanted to be 100% sure, we'd re-read the blob and save it, 
            // but fetching a blob URL is cheap.
             // Let's verify if it needs saving? 
             // Actually, if the user JUST generated it, it might be a blob URL if we changed the generation logic.
             // But currently generateSeedream returns base64/http.
             // So blob: URLs ONLY come from our `loadGenerations` (hydration).
             // So it's safe to assume it's already in DB.
             return makeRef(key);
          }

          // It is a Data URL or HTTP URL. Save it.
          try {
            const blob = await urlToBlob(img);
            await store.setItem(key, blob);
            return makeRef(key);
          } catch (e) {
            console.error(`Failed to save image ${key}`, e);
            // Fallback: keep original string if save fails? 
            // But that defeats the purpose. If we can't save, we might lose it.
            return img; 
          }
        })
      );

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
      
      const hydratedGen = { ...gen, images, inputImages };

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
    .filter((key) => key.startsWith("img:") && !referencedKeys.has(key))
    .map((key) => store.removeItem(key));

  if (removals.length === 0) return;
  await Promise.allSettled(removals);
}
