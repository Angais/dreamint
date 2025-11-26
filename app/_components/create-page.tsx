"use client";

import NextImage from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import localforage from "localforage";
import { debugLog } from "./create-page/logger";
import { generateSeedream } from "../actions/generate-seedream";
import { calculateImageSize, type AspectKey, type QualityKey, type Provider, type OutputFormat } from "../lib/seedream-options";
import { EmptyState } from "./create-page/empty-state";
import { GenerationGroup } from "./create-page/generation-list";
import { GalleryView } from "./create-page/gallery-view";
import { Header } from "./create-page/header";
import { Lightbox } from "./create-page/lightbox";
import { AttachmentLightbox } from "./create-page/attachment-lightbox";
import { createId, groupByDate, normalizeImages } from "./create-page/utils";
import type { GalleryEntry, Generation, PromptAttachment } from "./create-page/types";

const defaultPrompt =
  "Cinematic shot of a futuristic city at night, neon lights, rain reflections, highly detailed, 8k resolution";
const defaultAspect: AspectKey = "portrait-9-16";
const defaultQuality: QualityKey = "2k";
const defaultOutputFormat: OutputFormat = "png";

const STORAGE_KEYS = {
  prompt: "seedream:prompt",
  aspect: "seedream:aspect",
  quality: "seedream:quality",
  provider: "seedream:provider",
  outputFormat: "seedream:output_format",
  imageCount: "seedream:image_count",
  generations: "seedream:generations",
  pendingGenerations: "seedream:pending_generations",
  apiKey: "seedream:api_key",
  budgetCents: "seedream:budget_cents",
  spentCents: "seedream:spent_cents",
  geminiApiKey: "seedream:gemini_api_key",
} as const;

const MAX_ATTACHMENTS = 8;
const ATTACHMENT_LIMIT_MESSAGE = `Maximum of ${MAX_ATTACHMENTS} images allowed.`;
const ATTACHMENT_TYPE_MESSAGE = "Only image files can be used for editing.";
const ATTACHMENT_READ_MESSAGE = "Unable to load one of the images you pasted or uploaded.";
const ATTACHMENT_ERROR_MESSAGES = new Set([
  ATTACHMENT_LIMIT_MESSAGE,
  ATTACHMENT_TYPE_MESSAGE,
  ATTACHMENT_READ_MESSAGE,
]);

const ASPECT_VALUES: AspectKey[] = [
  "square-1-1",
  "portrait-2-3",
  "portrait-3-4",
  "portrait-4-5",
  "portrait-9-16",
  "landscape-3-2",
  "landscape-4-3",
  "landscape-5-4",
  "landscape-16-9",
  "landscape-21-9",
];
const QUALITY_VALUES: QualityKey[] = ["1k", "2k", "4k"];

function isAspectKey(value: string | null): value is AspectKey {
  return typeof value === "string" && (ASPECT_VALUES as string[]).includes(value);
}

function isQualityKey(value: string | null): value is QualityKey {
  return typeof value === "string" && (QUALITY_VALUES as string[]).includes(value);
}

function safePersist(key: string, value: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.error(`Unable to persist ${key} in localStorage`, error);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read image"));
    };
    reader.readAsDataURL(file);
  });
}

async function loadImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => resolve(null);
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

function findClosestAspect(width: number, height: number): AspectKey {
  const ratio = width / height;
  let closestAspect: AspectKey = defaultAspect;
  let minDiff = Number.MAX_VALUE;

  for (const key of ASPECT_VALUES) {
    const parts = key.split("-");
    // format: orientation-w-h
    if (parts.length < 3) continue;
    
    const w = parseInt(parts[1], 10);
    const h = parseInt(parts[2], 10);
    
    if (isNaN(w) || isNaN(h)) continue;
    
    const targetRatio = w / h;
    const diff = Math.abs(ratio - targetRatio);
    
    if (diff < minDiff) {
      minDiff = diff;
      closestAspect = key;
    }
  }
  
  return closestAspect;
}

let largeStateStore: typeof localforage | null = null;

function getLargeStateStore(): typeof localforage | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!largeStateStore) {
    largeStateStore = localforage.createInstance({
      name: "nano-banana-pro",
      storeName: "state",
      description: "Nano Banana Pro gallery cache",
    });
  }

  return largeStateStore;
}

export function CreatePage() {
  const [view, setView] = useState<"create" | "gallery">("create");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspect, setAspect] = useState<AspectKey>(defaultAspect);
  const [quality, setQuality] = useState<QualityKey>(defaultQuality);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultOutputFormat);
  const [provider, setProvider] = useState<Provider>("fal");
  const [imageCount, setImageCount] = useState<number>(4);
  const [apiKey, setApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<PromptAttachment | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<Generation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightboxSelection, setLightboxSelection] = useState<{ generationId: string; imageIndex: number } | null>(null);
  const storageHydratedRef = useRef(false);
  const pendingHydratedRef = useRef(false);
  const pendingReconciledRef = useRef(false);

  const clearAttachmentError = useCallback(() => {
    setError((previous) => (previous && ATTACHMENT_ERROR_MESSAGES.has(previous) ? null : previous));
  }, [setError]);

  const isAttachmentLimitReached = attachments.length >= MAX_ATTACHMENTS;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const loadState = async () => {
      try {
        const storedPrompt = window.localStorage.getItem(STORAGE_KEYS.prompt);
        if (storedPrompt !== null) {
          setPrompt(storedPrompt);
        }

        const storedAspect = window.localStorage.getItem(STORAGE_KEYS.aspect);
        if (isAspectKey(storedAspect)) {
          setAspect(storedAspect);
        }

        const storedQuality = window.localStorage.getItem(STORAGE_KEYS.quality);
        if (isQualityKey(storedQuality)) {
          setQuality(storedQuality);
        }

        const storedProvider = window.localStorage.getItem(STORAGE_KEYS.provider);
        if (storedProvider === "fal" || storedProvider === "gemini") {
          setProvider(storedProvider);
        }

        const storedOutputFormat = window.localStorage.getItem(STORAGE_KEYS.outputFormat);
        if (storedOutputFormat === "png" || storedOutputFormat === "jpeg" || storedOutputFormat === "webp") {
          setOutputFormat(storedOutputFormat);
        }

        const storedImageCount = window.localStorage.getItem(STORAGE_KEYS.imageCount);
        if (storedImageCount !== null) {
          const count = parseInt(storedImageCount, 10);
          if (Number.isFinite(count) && count >= 1 && count <= 4) {
            setImageCount(count);
          }
        }

        const storedApiKey = window.localStorage.getItem(STORAGE_KEYS.apiKey);
        if (storedApiKey !== null) {
          setApiKey(storedApiKey);
        }

        const storedGeminiApiKey = window.localStorage.getItem(STORAGE_KEYS.geminiApiKey);
        if (storedGeminiApiKey !== null) {
          setGeminiApiKey(storedGeminiApiKey);
        }

        let generationData: Generation[] | null = null;
        let pendingData: Generation[] | null = null;

        const store = getLargeStateStore();
        if (store) {
          const [restoredGenerations, restoredPending] = await Promise.all([
            store.getItem<Generation[]>(STORAGE_KEYS.generations),
            store.getItem<Generation[]>(STORAGE_KEYS.pendingGenerations),
          ]);

          if (Array.isArray(restoredGenerations)) {
            generationData = restoredGenerations;
          }

          if (Array.isArray(restoredPending)) {
            pendingData = restoredPending;
            pendingHydratedRef.current = restoredPending.length > 0;
          }
        }

        if (!generationData) {
          const legacyGenerations = window.localStorage.getItem(STORAGE_KEYS.generations);
          if (legacyGenerations) {
            try {
              const parsed = JSON.parse(legacyGenerations) as Generation[];
              if (Array.isArray(parsed)) {
                generationData = parsed;
              }
            } catch (legacyError) {
              console.error("Failed to parse legacy generations cache", legacyError);
            } finally {
              window.localStorage.removeItem(STORAGE_KEYS.generations);
            }
          }
        }

        if (!pendingData) {
          const legacyPending = window.localStorage.getItem(STORAGE_KEYS.pendingGenerations);
          if (legacyPending) {
            try {
              const parsed = JSON.parse(legacyPending) as Generation[];
              if (Array.isArray(parsed)) {
                pendingData = parsed;
              }
            } catch (legacyError) {
              console.error("Failed to parse legacy pending cache", legacyError);
            } finally {
              window.localStorage.removeItem(STORAGE_KEYS.pendingGenerations);
            }
          }
        }

        if (!cancelled) {
          if (generationData) {
            setGenerations(
              generationData.map((generation) => ({
                ...generation,
                outputFormat: generation.outputFormat ?? defaultOutputFormat,
              })),
            );
          }
          if (pendingData) {
            setPendingGenerations(
              pendingData.map((pending) => ({
                ...pending,
                outputFormat: pending.outputFormat ?? defaultOutputFormat,
              })),
            );
          }
        }
      } catch (error) {
        console.error("Unable to restore Seedream state", error);
    } finally {
      if (!cancelled) {
        storageHydratedRef.current = true;
        if (!pendingHydratedRef.current) {
          pendingReconciledRef.current = true;
        }
      }
    }
  };

    loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageHydratedRef.current || pendingReconciledRef.current || !pendingHydratedRef.current) {
      return;
    }

    if (pendingGenerations.length === 0) {
      pendingReconciledRef.current = true;
      pendingHydratedRef.current = false;
      return;
    }

    const noKeys = apiKey.trim().length === 0 && geminiApiKey.trim().length === 0;
    if (noKeys) {
      debugLog("pending:cleared-no-keys", {
        count: pendingGenerations.length,
      });
      setPendingGenerations([]);
      const store = getLargeStateStore();
      if (store) {
        void store.removeItem(STORAGE_KEYS.pendingGenerations);
      }
      pendingReconciledRef.current = true;
      pendingHydratedRef.current = false;
      return;
    }

    debugLog("pending:recovered-stale", {
      count: pendingGenerations.length,
      ids: pendingGenerations.map((gen) => gen.id),
    });

    setGenerations((previous) => {
      const existingIds = new Set(previous.map((gen) => gen.id));
      const reconciled = pendingGenerations.map((gen) =>
        existingIds.has(gen.id) ? { ...gen, id: createId("generation") } : gen,
      );
      return [...reconciled, ...previous];
    });
    setPendingGenerations([]);
    pendingReconciledRef.current = true;
    pendingHydratedRef.current = false;
  }, [pendingGenerations, apiKey, geminiApiKey]);

  const activeFeed = useMemo(
    () => [...pendingGenerations, ...generations],
    [generations, pendingGenerations],
  );

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      safePersist(STORAGE_KEYS.prompt, prompt);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [prompt]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    safePersist(STORAGE_KEYS.aspect, aspect);
    safePersist(STORAGE_KEYS.quality, quality);
    safePersist(STORAGE_KEYS.outputFormat, outputFormat);
    safePersist(STORAGE_KEYS.provider, provider);
    safePersist(STORAGE_KEYS.imageCount, String(imageCount));

    const normalizedApiKey = apiKey.trim();
    safePersist(STORAGE_KEYS.apiKey, normalizedApiKey.length > 0 ? normalizedApiKey : null);

    const normalizedGeminiApiKey = geminiApiKey.trim();
    safePersist(STORAGE_KEYS.geminiApiKey, normalizedGeminiApiKey.length > 0 ? normalizedGeminiApiKey : null);

  }, [
    aspect,
    quality,
    outputFormat,
    provider,
    imageCount,
    apiKey,
    geminiApiKey,
  ]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    const store = getLargeStateStore();
    if (!store) {
      return;
    }

    const persistGenerations = async () => {
      try {
        if (generations.length > 0) {
          await store.setItem(STORAGE_KEYS.generations, generations);
        } else {
          await store.removeItem(STORAGE_KEYS.generations);
        }
      } catch (error) {
        console.error("Unable to persist generations to storage", error);
      }
    };

    void persistGenerations();
  }, [generations]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    const store = getLargeStateStore();
    if (!store) {
      return;
    }

    const persistPending = async () => {
      try {
        if (pendingGenerations.length > 0) {
          await store.setItem(STORAGE_KEYS.pendingGenerations, pendingGenerations);
        } else {
          await store.removeItem(STORAGE_KEYS.pendingGenerations);
        }
      } catch (error) {
        console.error("Unable to persist pending generations to storage", error);
      }
    };

    void persistPending();
  }, [pendingGenerations]);

  const displayFeed = activeFeed;
  const hasGenerations = displayFeed.length > 0;

  const attachmentInputImages = useMemo(
    () =>
      attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
      })),
    [attachments],
  );

  const handleAspectSelect = useCallback(
    (value: string) => {
      if (isAspectKey(value)) {
        setAspect(value);
      }
    },
    [],
  );

  const groupedGenerations = useMemo(() => groupByDate(displayFeed), [displayFeed]);
  const pendingIdSet = useMemo(() => new Set(pendingGenerations.map((generation) => generation.id)), [pendingGenerations]);
  const errorGenerationId = error && displayFeed.length > 0 ? displayFeed[0].id : null;

  const galleryEntries = useMemo<GalleryEntry[]>(() => {
    const entries: GalleryEntry[] = [];

    generations.forEach((generation) => {
      generation.images.forEach((src, imageIndex) => {
        if (!src) {
          return;
        }

        entries.push({
          generationId: generation.id,
          imageIndex,
          src,
          prompt: generation.prompt,
          aspect: generation.aspect,
          quality: generation.quality,
          provider: generation.provider,
          outputFormat: generation.outputFormat,
          size: generation.size,
        });
      });
    });

    return entries;
  }, [generations]);

  const lightboxIndex = useMemo(() => {
    if (!lightboxSelection) {
      return -1;
    }

    return galleryEntries.findIndex(
      (entry) =>
        entry.generationId === lightboxSelection.generationId &&
        entry.imageIndex === lightboxSelection.imageIndex,
    );
  }, [galleryEntries, lightboxSelection]);

  useEffect(() => {
    if (galleryEntries.length === 0) {
      if (lightboxSelection !== null) {
        setLightboxSelection(null);
      }
      return;
    }

    if (lightboxSelection && lightboxIndex === -1) {
      setLightboxSelection(null);
    }
  }, [galleryEntries, lightboxSelection, lightboxIndex]);

  const lightboxEntry = lightboxIndex >= 0 ? galleryEntries[lightboxIndex] : null;
  const canGoPrev = lightboxIndex > 0;
  const canGoNext = lightboxIndex >= 0 && lightboxIndex < galleryEntries.length - 1;

  useEffect(() => {
    setIsDownloading(false);
  }, [lightboxSelection]);

  const handleAddAttachments = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        setError(ATTACHMENT_TYPE_MESSAGE);
        return;
      }

      const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
      if (availableSlots <= 0) {
        setError(ATTACHMENT_LIMIT_MESSAGE);
        return;
      }

      const filesToProcess = imageFiles.slice(0, availableSlots);

      try {
        const prepared = await Promise.all(
          filesToProcess.map(async (file) => {
            const dataUrl = await readFileAsDataUrl(file);
            const dimensions = await loadImageDimensions(dataUrl);
            return {
              id: createId("attachment"),
              name: file.name || "Reference image",
              url: dataUrl,
              width: dimensions?.width ?? null,
              height: dimensions?.height ?? null,
              kind: "local" as const,
            };
          }),
        );

        const existingUrls = new Set(attachments.map((attachment) => attachment.url));
        const uniquePrepared = prepared.filter((attachment) => !existingUrls.has(attachment.url));

        if (uniquePrepared.length === 0) {
          setError(ATTACHMENT_LIMIT_MESSAGE);
          return;
        }

        let addedCount = 0;
        setAttachments((previous) => {
          const stillAvailable = MAX_ATTACHMENTS - previous.length;
          if (stillAvailable <= 0) {
            return previous;
          }

          const nextItems = uniquePrepared.slice(0, stillAvailable);
          if (nextItems.length === 0) {
            return previous;
          }

          addedCount = nextItems.length;
          // Auto-set aspect based on first attachment if it's the first batch
          if (previous.length === 0 && nextItems[0].width && nextItems[0].height) {
             const closest = findClosestAspect(nextItems[0].width, nextItems[0].height);
             setAspect(closest);
          }

          return [...previous, ...nextItems];
        });

        if (addedCount > 0) {
          clearAttachmentError();
        } else {
          setError(ATTACHMENT_LIMIT_MESSAGE);
        }
      } catch (attachmentError) {
        console.error("Failed to read attachment", attachmentError);
        setError(ATTACHMENT_READ_MESSAGE);
      }
    },
    [attachments, clearAttachmentError, setError],
  );

  const handleRemoveAttachment = useCallback(
    (attachmentId: string) => {
      setAttachments((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
      clearAttachmentError();
    },
    [clearAttachmentError],
  );

  const handleAddAttachmentFromUrl = useCallback(
    async (url: string, name = "Edit input"): Promise<boolean> => {
      if (!url) {
        return false;
      }

      if (attachments.length >= MAX_ATTACHMENTS) {
        setError(ATTACHMENT_LIMIT_MESSAGE);
        return false;
      }

      if (attachments.some((attachment) => attachment.url === url)) {
        return false;
      }

      let width: number | null = null;
      let height: number | null = null;
      try {
        const dimensions = await loadImageDimensions(url);
        width = dimensions?.width ?? null;
        height = dimensions?.height ?? null;
      } catch (dimensionError) {
        console.error("Failed to read dimensions for attachment", dimensionError);
      }

      setAttachments((previous) => {
        const next = [
          ...previous,
          { id: createId("attachment"), name, url, kind: "remote" as const, width, height },
        ];
        
        if (previous.length === 0 && width && height) {
             const closest = findClosestAspect(width, height);
             setAspect(closest);
        }
        
        return next;
      });
      clearAttachmentError();
      return true;
    },
    [attachments, clearAttachmentError, setError],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    debugLog("submit:start", {
      aspect,
      quality,
      provider,
      imageCount,
      pendingGenerations: pendingGenerations.length,
      attachments: attachmentInputImages.map((image) => ({
        id: image.id,
        width: image.width ?? null,
        height: image.height ?? null,
      })),
    });

    const pendingId = createId("pending");
    const pendingSize = calculateImageSize(aspect, quality);
    const inputImageSnapshot = attachmentInputImages.map((image) => ({ ...image }));
    
    const pendingGeneration: Generation = {
      id: pendingId,
      prompt,
      aspect,
      quality,
      outputFormat,
      provider, // Added provider here
      size: pendingSize,
      createdAt: new Date().toISOString(),
      inputImages: inputImageSnapshot,
      images: Array(imageCount).fill(""),
    };

    debugLog("pending:prepare", {
      pendingId,
      size: pendingSize,
      inputImages: inputImageSnapshot.length,
    });

    setIsSettingsOpen(false);
    setError(null);
    setPendingGenerations((previous) => {
      const next = [pendingGeneration, ...previous];
      debugLog("pending:queued", { pendingId, pendingCount: next.length });
      return next;
    });

    const trimmedApiKey = apiKey.trim();
    const trimmedGeminiApiKey = geminiApiKey.trim();
    
    debugLog("submit:request", {
      pendingId,
      provider,
      apiKeyProvided: trimmedApiKey.length > 0,
      geminiApiKeyProvided: trimmedGeminiApiKey.length > 0,
      inputImages: inputImageSnapshot.length,
      imageCount
    });

    const generationPromise = generateSeedream({
      prompt,
      aspect,
      quality,
      numImages: imageCount,
      provider,
      outputFormat,
      apiKey: trimmedApiKey.length > 0 ? trimmedApiKey : undefined,
      geminiApiKey: trimmedGeminiApiKey.length > 0 ? trimmedGeminiApiKey : undefined,
      inputImages: inputImageSnapshot,
    });

    generationPromise
      .then((result) => {
        debugLog("generation:success", {
          pendingId,
          rawImageCount: result.images.length,
          size: result.size,
        });

        const normalizedImages = normalizeImages(result.images);
        debugLog("generation:normalized", {
          pendingId,
          normalizedCount: normalizedImages.length,
          urlsSample: normalizedImages.slice(0, 8),
        });

        const generation: Generation = {
          ...result,
          id: createId("generation"),
          images: normalizedImages,
        };

        setGenerations((previous) => {
          const next = [generation, ...previous];
          debugLog("generations:prepended", {
            generationId: generation.id,
            total: next.length,
          });
          return next;
        });
      })
      .catch((generationError: unknown) => {
        const message =
          generationError instanceof Error
            ? generationError.message
            : "Generation failed.";
        debugLog("generation:error", { pendingId, message, error: generationError });
        setError(message);
      })
      .finally(() => {
        setPendingGenerations((previous) => {
          const next = previous.filter((generation) => generation.id !== pendingId);
          debugLog("pending:cleared", {
            pendingId,
            before: previous.length,
            after: next.length,
          });
          return next;
        });
      });
  };

  const handleExpand = useCallback((generationId: string, imageIndex: number) => {
    setLightboxSelection({ generationId, imageIndex });
    setIsSettingsOpen(false);
    setIsDownloading(false);
  }, [setLightboxSelection, setIsSettingsOpen, setIsDownloading]);

  const handleDownload = async (entry: GalleryEntry) => {
    setIsDownloading(true);
    try {
      const response = await fetch(entry.src, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const format = entry.outputFormat ?? "png";
      const extension = format === "jpeg" ? "jpg" : format;
      link.href = url;
      link.download = `seedream-${Date.now()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      const message =
        downloadError instanceof Error ? downloadError.message : "Unable to download image.";
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseLightbox = () => {
    setLightboxSelection(null);
    setIsDownloading(false);
  };

  const handlePrevImage = () => {
    if (lightboxIndex <= 0) {
      return;
    }

    const previousEntry = galleryEntries[lightboxIndex - 1];
    if (previousEntry) {
      setLightboxSelection({
        generationId: previousEntry.generationId,
        imageIndex: previousEntry.imageIndex,
      });
      setIsDownloading(false);
    }
  };

  const handleNextImage = () => {
    if (lightboxIndex < 0 || lightboxIndex >= galleryEntries.length - 1) {
      return;
    }

    const nextEntry = galleryEntries[lightboxIndex + 1];
    if (nextEntry) {
      setLightboxSelection({
        generationId: nextEntry.generationId,
        imageIndex: nextEntry.imageIndex,
      });
      setIsDownloading(false);
    }
  };

  const handlePreviewAttachment = useCallback((attachment: PromptAttachment) => {
    setAttachmentPreview(attachment);
  }, []);

  const handlePreviewInputImage = useCallback((image: Generation["inputImages"][number]) => {
    setAttachmentPreview({
      id: image.id ?? createId("attachment"),
      name: image.name ?? "Reference image",
      url: image.url,
      width: image.width ?? null,
      height: image.height ?? null,
      kind: "remote",
    });
  }, []);

  const handleLightboxEdit = useCallback(
    async (entry: GalleryEntry) => {
      const added = await handleAddAttachmentFromUrl(entry.src, entry.prompt || "Generated image");
      if (added) {
        setLightboxSelection(null);
        setIsSettingsOpen(false);
        setIsDownloading(false);
      }
    },
    [handleAddAttachmentFromUrl, setIsDownloading, setIsSettingsOpen, setLightboxSelection],
  );

  const handleRetryGeneration = useCallback(
    (generationId: string) => {
      const generation = generations.find((gen) => gen.id === generationId);
      if (!generation) {
        return;
      }

      const pendingId = createId("pending");
      const numImages = Math.max(1, generation.images.length || 1);
      const pendingSize = calculateImageSize(generation.aspect, generation.quality);
      const inputImageSnapshot = generation.inputImages?.map((image) => ({ ...image })) ?? [];

      const pendingGeneration: Generation = {
        ...generation,
        id: pendingId,
        images: Array(numImages).fill(""),
        createdAt: new Date().toISOString(),
        inputImages: inputImageSnapshot,
        size: pendingSize,
        outputFormat: generation.outputFormat ?? defaultOutputFormat,
      };

      debugLog("pending:retry", {
        fromId: generationId,
        pendingId,
        numImages,
        aspect: generation.aspect,
        quality: generation.quality,
        provider: generation.provider,
        inputImages: inputImageSnapshot.length,
      });

      setGenerations((previous) => previous.filter((gen) => gen.id !== generationId));
      setPendingGenerations((previous) => [pendingGeneration, ...previous.filter((gen) => gen.id !== pendingId)]);
      setError(null);
      setIsSettingsOpen(false);

      const generationPromise = generateSeedream({
        prompt: generation.prompt,
        aspect: generation.aspect,
        quality: generation.quality,
        numImages,
        provider: generation.provider,
        outputFormat: generation.outputFormat ?? defaultOutputFormat,
        apiKey: apiKey.trim() || undefined,
        geminiApiKey: geminiApiKey.trim() || undefined,
        inputImages: inputImageSnapshot,
      });

      generationPromise
        .then((result) => {
          debugLog("generation:success", {
            pendingId,
            rawImageCount: result.images.length,
            size: result.size,
          });

          const normalizedImages = normalizeImages(result.images);
          debugLog("generation:normalized", {
            pendingId,
            normalizedCount: normalizedImages.length,
            urlsSample: normalizedImages.slice(0, 8),
          });

          const nextGeneration: Generation = {
            ...result,
            id: createId("generation"),
            images: normalizedImages,
          };

          setGenerations((previous) => {
            const next = [nextGeneration, ...previous];
            debugLog("generations:prepended", {
              generationId: nextGeneration.id,
              total: next.length,
            });
            return next;
          });
        })
        .catch((generationError: unknown) => {
          const message =
            generationError instanceof Error
              ? generationError.message
              : "Generation failed.";
          debugLog("generation:error", { pendingId, message, error: generationError });
          setError(message);
        })
        .finally(() => {
          setPendingGenerations((previous) => {
            const next = previous.filter((gen) => gen.id !== pendingId);
            debugLog("pending:cleared", {
              pendingId,
              before: previous.length,
              after: next.length,
            });
            return next;
          });
        });
    },
    [apiKey, geminiApiKey, generations],
  );

  const handleDeleteGeneration = useCallback(
    (generationId: string) => {
      const shouldClearError = Boolean(error && displayFeed.length > 0 && displayFeed[0].id === generationId);

      setGenerations((previous) => previous.filter((generation) => generation.id !== generationId));
      setPendingGenerations((previous) => previous.filter((generation) => generation.id !== generationId));
      setLightboxSelection((selection) =>
        selection && selection.generationId === generationId ? null : selection,
      );

      if (shouldClearError) {
        setError(null);
      }
    },
    [displayFeed, error, setError, setLightboxSelection],
  );

  const handleUsePrompt = useCallback((value: string, inputImages: Generation["inputImages"]) => {
    setPrompt(value);
    setIsSettingsOpen(false);

    if (inputImages.length > 0) {
      setAttachments(
        inputImages.slice(0, MAX_ATTACHMENTS).map((image) => ({
          id: image.id ?? createId("attachment"),
          name: image.name,
          url: image.url,
          width: image.width ?? null,
          height: image.height ?? null,
          kind: "remote" as const,
        })),
      );
      clearAttachmentError();
    } else {
      setAttachments([]);
      setAttachmentPreview(null);
      clearAttachmentError();
    }
  }, [clearAttachmentError]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-6 top-6 z-50 hidden flex-col items-center gap-1 select-none 2xl:flex"
      >
        <NextImage
          src="/Dreaming.png"
          alt="Dreamint logo"
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover grayscale"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white">Dreamint</span>
      </div>

      {/* Main Content */}
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-8 px-6 pb-48 pt-10 lg:px-10">
        
        {/* Navigation Tabs */}
        <div className="pointer-events-none sticky top-4 z-30 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] p-1 border border-[var(--border-subtle)] shadow-lg shadow-black/20">
            <button
              onClick={() => setView("create")}
              className={`rounded-full px-6 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                view === "create"
                  ? "bg-[var(--text-primary)] text-black shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setView("gallery")}
              className={`rounded-full px-6 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                view === "gallery"
                  ? "bg-[var(--text-primary)] text-black shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              Gallery
            </button>
          </div>
        </div>

        {view === "create" ? (
          <main className="flex flex-1 flex-col gap-12">
            {hasGenerations ? (
              groupedGenerations.map((group) => (
              <GenerationGroup
                key={group.key}
                label={group.label}
                generations={group.items}
                pendingIdSet={pendingIdSet}
                errorGenerationId={errorGenerationId}
                errorMessage={error}
                onExpand={handleExpand}
                onUsePrompt={handleUsePrompt}
                onPreviewInputImage={handlePreviewInputImage}
                onDeleteGeneration={handleDeleteGeneration}
                onRetryGeneration={handleRetryGeneration}
              />
            ))
          ) : (
            <EmptyState />
          )}
          </main>
        ) : (
          <GalleryView generations={generations} onExpand={handleExpand} />
        )}
      </div>
      
      {/* Floating Header at Bottom (Only in Create View) */}
      {view === "create" && (
        <div className="fixed bottom-8 left-0 right-0 z-40 px-6 pointer-events-none">
          <div className="pointer-events-auto mx-auto w-full max-w-3xl">
              <Header
                prompt={prompt}
                aspect={aspect}
                quality={quality}
                outputFormat={outputFormat}
                provider={provider}
                imageCount={imageCount}
                apiKey={apiKey}
                geminiApiKey={geminiApiKey}
                isBudgetLocked={false}
                isSettingsOpen={isSettingsOpen}
                onSubmit={handleSubmit}
                onPromptChange={setPrompt}
                onAspectSelect={handleAspectSelect}
                onQualityChange={setQuality}
                onOutputFormatChange={setOutputFormat}
                onProviderChange={setProvider}
                onImageCountChange={setImageCount}
                onApiKeyChange={setApiKey}
                onGeminiApiKeyChange={setGeminiApiKey}
                onToggleSettings={setIsSettingsOpen}
                attachments={attachments}
                onAddAttachments={handleAddAttachments}
                onRemoveAttachment={handleRemoveAttachment}
                onPreviewAttachment={handlePreviewAttachment}
                isAttachmentLimitReached={isAttachmentLimitReached}
              />
          </div>
        </div>
      )}

      {attachmentPreview ? (
        <AttachmentLightbox attachment={attachmentPreview} onClose={() => setAttachmentPreview(null)} />
      ) : null}
      {lightboxEntry ? (
        <Lightbox
          entry={lightboxEntry}
          onClose={handleCloseLightbox}
          onDownload={() => handleDownload(lightboxEntry)}
          isDownloading={isDownloading}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onEdit={() => { void handleLightboxEdit(lightboxEntry); }}
        />
      ) : null}
    </div>
  );
}
