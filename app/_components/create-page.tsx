"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import localforage, { type LocalForage } from "localforage";
import { generateSeedream } from "../actions/generate-seedream";
import { calculateImageSize, type AspectKey, type QualityKey } from "../lib/seedream-options";
import { EmptyState } from "./create-page/empty-state";
import { GenerationGroup } from "./create-page/generation-list";
import { Header } from "./create-page/header";
import { Lightbox } from "./create-page/lightbox";
import { AttachmentLightbox } from "./create-page/attachment-lightbox";
import { createId, groupByDate, normalizeImages, parseSeed } from "./create-page/utils";
import type { GalleryEntry, Generation, PromptAttachment } from "./create-page/types";

const defaultPrompt =
  "Dreamlike pastel illustration of a floating island garden, cinematic lighting, painterly brushstrokes";
const defaultAspect: AspectKey = "portrait-9-16";
const defaultQuality: QualityKey = "high";
const ATTACHMENT_ASPECT_PREFIX = "attachment:";

const STORAGE_KEYS = {
  prompt: "seedream:prompt",
  aspect: "seedream:aspect",
  quality: "seedream:quality",
  seed: "seedream:seed",
  generations: "seedream:generations",
  pendingGenerations: "seedream:pending_generations",
  apiKey: "seedream:api_key",
  customWidth: "seedream:custom_width",
  customHeight: "seedream:custom_height",
  useCustomResolution: "seedream:use_custom_resolution",
} as const;

const MIN_IMAGE_DIMENSION = 512;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_ATTACHMENTS = 4;
const ATTACHMENT_LIMIT_MESSAGE = `Maximum of ${MAX_ATTACHMENTS} images allowed.`;
const ATTACHMENT_TYPE_MESSAGE = "Only image files can be used for editing.";
const ATTACHMENT_READ_MESSAGE = "Unable to load one of the images you pasted or uploaded.";
const ATTACHMENT_ERROR_MESSAGES = new Set([
  ATTACHMENT_LIMIT_MESSAGE,
  ATTACHMENT_TYPE_MESSAGE,
  ATTACHMENT_READ_MESSAGE,
]);

type AttachmentAspectOption = {
  value: string;
  label: string;
  ratio: string;
  resolution: string;
  width: number;
  height: number;
  attachmentId: string;
};

const ASPECT_VALUES: AspectKey[] = [
  "square-1-1",
  "portrait-4-5",
  "portrait-9-16",
  "landscape-3-2",
  "landscape-16-9",
  "landscape-21-9",
];

const QUALITY_VALUES: QualityKey[] = ["standard", "high", "ultra", "four-k"];

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

function parseCustomDimension(value: string): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (Number.isNaN(numeric)) {
    return null;
  }

  if (numeric < MIN_IMAGE_DIMENSION || numeric > MAX_IMAGE_DIMENSION) {
    return null;
  }

  return numeric;
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

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function formatAspectRatioLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return "? : ?";
  }
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)} : ${Math.round(height / divisor)}`;
}

function formatResolutionLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return "Unknown";
  }
  return `${width} x ${height}`;
}

let largeStateStore: LocalForage | null = null;

function getLargeStateStore(): LocalForage | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!largeStateStore) {
    largeStateStore = localforage.createInstance({
      name: "seedream",
      storeName: "state",
      description: "Seedream gallery cache",
    });
  }

  return largeStateStore;
}

export function CreatePage() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspect, setAspect] = useState<AspectKey | "custom" >(defaultAspect);
  const [aspectSelection, setAspectSelection] = useState<string>(defaultAspect);
  const [quality, setQuality] = useState<QualityKey>(defaultQuality);
  const [seed, setSeed] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useCustomResolution, setUseCustomResolution] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<PromptAttachment | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<Generation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightboxSelection, setLightboxSelection] = useState<{ generationId: string; imageIndex: number } | null>(null);
  const storageHydratedRef = useRef(false);

  const clearAttachmentError = useCallback(() => {
    setError((previous) => (previous && ATTACHMENT_ERROR_MESSAGES.has(previous) ? null : previous));
  }, [setError]);

  const hasActiveGeneration = pendingGenerations.length > 0 || isPending;
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

        const storedAspectSelection = window.localStorage.getItem(STORAGE_KEYS.aspect);
        if (storedAspectSelection) {
          if (storedAspectSelection.startsWith(ATTACHMENT_ASPECT_PREFIX)) {
            setAspect("custom");
            setAspectSelection(storedAspectSelection);
          } else if (storedAspectSelection === "custom") {
            setAspect("custom");
            setAspectSelection("custom");
          } else if (isAspectKey(storedAspectSelection)) {
            setAspect(storedAspectSelection);
            setAspectSelection(storedAspectSelection);
          }
        }

        const storedQuality = window.localStorage.getItem(STORAGE_KEYS.quality);
        if (isQualityKey(storedQuality)) {
          setQuality(storedQuality);
        }

        const storedSeed = window.localStorage.getItem(STORAGE_KEYS.seed);
        if (storedSeed !== null) {
          setSeed(storedSeed);
        }

        const storedApiKey = window.localStorage.getItem(STORAGE_KEYS.apiKey);
        if (storedApiKey !== null) {
          setApiKey(storedApiKey);
        }

        const storedUseCustom = window.localStorage.getItem(STORAGE_KEYS.useCustomResolution);
        if (storedUseCustom === "true") {
          setUseCustomResolution(true);
        }

        const storedCustomWidth = window.localStorage.getItem(STORAGE_KEYS.customWidth);
        if (storedCustomWidth !== null) {
          setCustomWidth(storedCustomWidth);
        }

        const storedCustomHeight = window.localStorage.getItem(STORAGE_KEYS.customHeight);
        if (storedCustomHeight !== null) {
          setCustomHeight(storedCustomHeight);
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
            setGenerations(generationData);
          }
          if (pendingData) {
            setPendingGenerations(pendingData);
          }
        }
      } catch (error) {
        console.error("Unable to restore Seedream state", error);
      } finally {
        if (!cancelled) {
          storageHydratedRef.current = true;
        }
      }
    };

    loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeFeed = useMemo(
    () => [...pendingGenerations, ...generations],
    [generations, pendingGenerations],
  );

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    safePersist(STORAGE_KEYS.prompt, prompt);
    safePersist(STORAGE_KEYS.aspect, aspectSelection);
    safePersist(STORAGE_KEYS.quality, quality);
    safePersist(STORAGE_KEYS.seed, seed);

    const normalizedApiKey = apiKey.trim();
    safePersist(STORAGE_KEYS.apiKey, normalizedApiKey.length > 0 ? normalizedApiKey : null);
    safePersist(STORAGE_KEYS.useCustomResolution, useCustomResolution ? "true" : null);
    safePersist(
      STORAGE_KEYS.customWidth,
      useCustomResolution && customWidth ? customWidth : null,
    );
    safePersist(
      STORAGE_KEYS.customHeight,
      useCustomResolution && customHeight ? customHeight : null,
    );
  }, [prompt, aspectSelection, quality, seed, apiKey, useCustomResolution, customWidth, customHeight]);

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

  const attachmentAspectOptions = useMemo<AttachmentAspectOption[]>(() => {
    return attachments
      .map((attachment, index) => {
        if (!attachment.width || !attachment.height) {
          return null;
        }

        return {
          value: `${ATTACHMENT_ASPECT_PREFIX}${attachment.id}`,
          label: `Image ${index + 1}`,
          ratio: formatAspectRatioLabel(attachment.width, attachment.height),
          resolution: formatResolutionLabel(attachment.width, attachment.height),
          width: attachment.width,
          height: attachment.height,
          attachmentId: attachment.id,
        };
      })
      .filter((option): option is AttachmentAspectOption => option !== null);
  }, [attachments]);

  const handleAspectSelect = useCallback(
    (value: string) => {
      setAspectSelection(value);

      if (value.startsWith(ATTACHMENT_ASPECT_PREFIX)) {
        const attachmentId = value.slice(ATTACHMENT_ASPECT_PREFIX.length);
        const target = attachments.find((attachment) => attachment.id === attachmentId);
        if (aspect !== "custom") {
          setAspect("custom");
        }
        if (!useCustomResolution) {
          setUseCustomResolution(true);
        }
        if (target && target.width && target.height) {
          const widthString = String(target.width);
          const heightString = String(target.height);
          if (customWidth !== widthString) {
            setCustomWidth(widthString);
          }
          if (customHeight !== heightString) {
            setCustomHeight(heightString);
          }
        }
        clearAttachmentError();
        return;
      }

      if (value === "custom") {
        if (aspect !== "custom") {
          setAspect("custom");
        }
        if (!useCustomResolution) {
          setUseCustomResolution(true);
        }
        return;
      }

      if (isAspectKey(value)) {
        if (aspect !== value) {
          setAspect(value);
        }
        if (useCustomResolution) {
          setUseCustomResolution(false);
        }
        return;
      }
    },
    [aspect, attachments, clearAttachmentError, customHeight, customWidth, useCustomResolution],
  );

  useEffect(() => {
    if (!aspectSelection.startsWith(ATTACHMENT_ASPECT_PREFIX)) {
      return;
    }

    const attachmentId = aspectSelection.slice(ATTACHMENT_ASPECT_PREFIX.length);
    const target = attachments.find((attachment) => attachment.id === attachmentId);

    if (!target) {
      if (aspect !== defaultAspect) {
        setAspect(defaultAspect);
      }
      if (aspectSelection !== defaultAspect) {
        setAspectSelection(defaultAspect);
      }
      if (useCustomResolution) {
        setUseCustomResolution(false);
      }
      return;
    }

    if (aspect !== "custom") {
      setAspect("custom");
    }

    if (target.width && target.height) {
      const widthString = String(target.width);
      const heightString = String(target.height);
      if (customWidth !== widthString) {
        setCustomWidth(widthString);
      }
      if (customHeight !== heightString) {
        setCustomHeight(heightString);
      }
      if (!useCustomResolution) {
        setUseCustomResolution(true);
      }
    }
  }, [aspectSelection, attachments, aspect, customHeight, customWidth, useCustomResolution]);

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
    async (url: string, name = "Seedream edit input"): Promise<boolean> => {
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

      setAttachments((previous) => [
        ...previous,
        { id: createId("attachment"), name, url, kind: "remote", width, height },
      ]);
      clearAttachmentError();
      return true;
    },
    [attachments, clearAttachmentError, setError],
  );
  const handleToggleCustomResolution = useCallback((enabled: boolean) => {
    setUseCustomResolution(enabled);
    if (enabled) {
      const referenceAspect = aspect === "custom" ? defaultAspect : aspect;
      const defaultSize = calculateImageSize(referenceAspect, quality);
      setCustomWidth((previous) => (previous ? previous : String(defaultSize.width)));
      setCustomHeight((previous) => (previous ? previous : String(defaultSize.height)));
      if (!aspectSelection.startsWith(ATTACHMENT_ASPECT_PREFIX)) {
        setAspectSelection("custom");
      }
      if (aspect !== "custom") {
        setAspect("custom");
      }
    } else {
      if (aspect === "custom") {
        setAspect(defaultAspect);
      }
      if (aspectSelection === "custom" || aspectSelection.startsWith(ATTACHMENT_ASPECT_PREFIX)) {
        setAspectSelection(defaultAspect);
      }
    }
  }, [aspect, aspectSelection, quality]);
  const handleCustomWidthChange = useCallback((value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    setCustomWidth(digits);
  }, []);

  const handleCustomHeightChange = useCallback((value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    setCustomHeight(digits);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedSeed = parseSeed(seed);
    const pendingId = createId("pending");

    const customSize = useCustomResolution
      ? (() => {
          const widthValue = parseCustomDimension(customWidth);
          const heightValue = parseCustomDimension(customHeight);
          if (widthValue === null || heightValue === null) {
            return null;
          }

          return { width: widthValue, height: heightValue };
        })()
      : null;

    if (useCustomResolution && !customSize) {
      setError(`Custom resolution must be between ${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION} pixels.`);
      setIsSettingsOpen(true);
      return;
    }

    const baseAspectForSize = aspect === "custom" ? defaultAspect : aspect;
    const pendingSize = customSize ?? calculateImageSize(baseAspectForSize, quality);
    const inputImageSnapshot = attachmentInputImages.map((image) => ({ ...image }));
    const pendingGeneration: Generation = {
      id: pendingId,
      prompt,
      aspect,
      quality,
      seed: parsedSeed,
      size: pendingSize,
      createdAt: new Date().toISOString(),
      inputImages: inputImageSnapshot,
      images: ["", "", "", ""],
    };

    setIsSettingsOpen(false);
    setError(null);
    setPendingGenerations((previous) => [pendingGeneration, ...previous]);

    startTransition(() => {
      const trimmedApiKey = apiKey.trim();
      const generationPromise = generateSeedream({
        prompt,
        aspect,
        quality,
        seed: typeof parsedSeed === "number" ? parsedSeed : undefined,
        apiKey: trimmedApiKey.length > 0 ? trimmedApiKey : undefined,
        sizeOverride: customSize ?? undefined,
        inputImages: inputImageSnapshot,
      });

      generationPromise
        .then((result) => {
          const generation: Generation = {
            ...result,
            id: createId("generation"),
            images: normalizeImages(result.images),
          };

          setGenerations((previous) => [generation, ...previous]);
          setSeed(generation.seed ? String(generation.seed) : "");
        })
        .catch((generationError: unknown) => {
          const message =
            generationError instanceof Error
              ? generationError.message
              : "Seedream generation failed.";
          setError(message);
        })
        .finally(() => {
          setPendingGenerations((previous) =>
            previous.filter((generation) => generation.id !== pendingId),
          );
        });
    });
  };

  const handleExpand = useCallback((generationId: string, imageIndex: number) => {
    setLightboxSelection({ generationId, imageIndex });
    setIsSettingsOpen(false);
    setIsDownloading(false);
  }, [setLightboxSelection, setIsSettingsOpen, setIsDownloading]);

  const handleDownload = async (src: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `seedream-${Date.now()}.png`;
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

  const handleUsePrompt = (value: string, inputImages: Generation["inputImages"]) => {
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
  };

  return (
    <div className="min-h-screen bg-[#08090f] text-[#f4f5f9]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-6 top-6 z-50 hidden flex-col items-center gap-1 select-none 2xl:flex"
      >
        <Image
          src="/Dreaming.png"
          alt="Dreamint logo"
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white">Dreamint</span>
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-10 px-6 pb-16 pt-10 lg:px-10">
        <Header
          prompt={prompt}
          aspectSelection={aspectSelection}
          attachmentAspectOptions={attachmentAspectOptions}
          quality={quality}
          seed={seed}
          apiKey={apiKey}
          isGenerating={hasActiveGeneration}
          isSettingsOpen={isSettingsOpen}
          onSubmit={handleSubmit}
          onPromptChange={setPrompt}
          onAspectSelect={handleAspectSelect}
          onQualityChange={setQuality}
          onSeedChange={setSeed}
          onApiKeyChange={setApiKey}
          useCustomResolution={useCustomResolution}
          customWidth={customWidth}
          customHeight={customHeight}
          onToggleCustomResolution={handleToggleCustomResolution}
          onCustomWidthChange={handleCustomWidthChange}
          onCustomHeightChange={handleCustomHeightChange}
          onToggleSettings={setIsSettingsOpen}
          attachments={attachments}
          onAddAttachments={handleAddAttachments}
          onRemoveAttachment={handleRemoveAttachment}
          onPreviewAttachment={handlePreviewAttachment}
          isAttachmentLimitReached={isAttachmentLimitReached}
        />
        <main className="flex flex-1 flex-col gap-10">
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
              />
            ))
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
      {attachmentPreview ? (
        <AttachmentLightbox attachment={attachmentPreview} onClose={() => setAttachmentPreview(null)} />
      ) : null}
      {lightboxEntry ? (
        <Lightbox
          entry={lightboxEntry}
          onClose={handleCloseLightbox}
          onDownload={() => handleDownload(lightboxEntry.src)}
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























