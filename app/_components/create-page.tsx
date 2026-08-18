"use client";

import NextImage from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debugLog } from "./create-page/logger";
import { generateImage } from "../lib/generate-image";
import {
  fetchImageModels,
  fetchModelEndpoints,
  getRangeMax,
  totalUsageCostUsd,
  type ImageModel,
  type OutputFormat,
  type ProviderPreference,
} from "../lib/openrouter";
import {
  AUTO_OPTION,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_QUALITY,
  DEFAULT_RESOLUTION,
  LEGACY_ASPECT_RATIO_BY_KEY,
  estimateImageSize,
  getSupportedAspectRatios,
  getSupportedOutputFormats,
  getSupportedQualities,
  getSupportedResolutions,
  resolveActiveParameters,
} from "../lib/image-options";
import { EmptyState } from "./create-page/empty-state";
import { GenerationGroup } from "./create-page/generation-list";
import { GalleryView } from "./create-page/gallery-view";
import { Header, type ModelEndpointsState } from "./create-page/header";
import { Lightbox } from "./create-page/lightbox";
import { AttachmentLightbox } from "./create-page/attachment-lightbox";
import { BudgetWidget } from "./create-page/budget-widget";
import { ChangelogModal } from "./create-page/changelog-modal";
import { createCollageBlob } from "./create-page/collage";
import { convertBlobToOutputFormat, extensionFromMimeType } from "./create-page/download-utils";
import { XIcon } from "./create-page/icons";
import { createId, groupByDate, normalizeImages } from "./create-page/utils";
import type {
  GalleryEntry,
  Generation,
  PromptAttachment,
  ReusePromptOptions,
} from "./create-page/types";
import { cacheGenerationAssets, clearPending, loadPending, restoreGenerations, persistGenerations, savePending, deleteGenerationData, deleteOutputImageData, cleanOrphanedImages, isStoredAssetRef, resolveStoredAssetBlob, resolveStoredAssetUrl } from "./create-page/storage";
import { useInfiniteScroll } from "./create-page/use-infinite-scroll";

const defaultPrompt =
  "Cinematic shot of a futuristic city at night, neon lights, rain reflections, highly detailed, 8k resolution";
const defaultOutputFormat: OutputFormat = "png";
const APP_VERSION = "2.0.0";

const STORAGE_KEYS = {
  prompt: "dreamint:prompt",
  promptHistory: "dreamint:prompt_history",
  aspectRatio: "dreamint:aspect_ratio",
  resolution: "dreamint:resolution",
  quality: "dreamint:quality",
  outputFormat: "dreamint:output_format",
  imageCount: "dreamint:image_count",
  budgetCents: "dreamint:budget_cents",
  spentCents: "dreamint:spent_cents",
  apiKey: "dreamint:openrouter_api_key",
  apiKeyUpdatedAt: "dreamint:openrouter_api_key_updated_at",
  enabledModels: "dreamint:enabled_models",
  selectedModel: "dreamint:selected_model",
  providerPrefs: "dreamint:model_providers",
  galleryPreferences: "dreamint:gallery_preferences",
} as const;

// Direct renames from the pre-OpenRouter "seedream:" prefix.
const LEGACY_KEY_RENAMES: Record<string, string> = {
  "seedream:prompt": STORAGE_KEYS.prompt,
  "seedream:prompt_history": STORAGE_KEYS.promptHistory,
  "seedream:output_format": STORAGE_KEYS.outputFormat,
  "seedream:image_count": STORAGE_KEYS.imageCount,
  "seedream:budget_cents": STORAGE_KEYS.budgetCents,
  "seedream:spent_cents": STORAGE_KEYS.spentCents,
  "seedream:openai_quality": STORAGE_KEYS.quality,
  "seedream:gallery_preferences": STORAGE_KEYS.galleryPreferences,
};

const LEGACY_RESOLUTION_BY_QUALITY: Record<string, string> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

function migrateLegacyLocalStorage() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    for (const [legacyKey, nextKey] of Object.entries(LEGACY_KEY_RENAMES)) {
      const value = window.localStorage.getItem(legacyKey);
      if (value !== null && window.localStorage.getItem(nextKey) === null) {
        window.localStorage.setItem(nextKey, value);
      }
    }

    const legacyAspect = window.localStorage.getItem("seedream:aspect");
    if (legacyAspect !== null && window.localStorage.getItem(STORAGE_KEYS.aspectRatio) === null) {
      const migratedAspect =
        legacyAspect === AUTO_OPTION ? AUTO_OPTION : LEGACY_ASPECT_RATIO_BY_KEY[legacyAspect];
      if (migratedAspect) {
        window.localStorage.setItem(STORAGE_KEYS.aspectRatio, migratedAspect);
      }
    }

    const legacyQuality = window.localStorage.getItem("seedream:quality");
    if (legacyQuality !== null && window.localStorage.getItem(STORAGE_KEYS.resolution) === null) {
      const migratedResolution = LEGACY_RESOLUTION_BY_QUALITY[legacyQuality];
      if (migratedResolution) {
        window.localStorage.setItem(STORAGE_KEYS.resolution, migratedResolution);
      }
    }

    const legacyKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("seedream:")) {
        legacyKeys.push(key);
      }
    }
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.error("Legacy localStorage migration failed", error);
  }
}

const MAX_ATTACHMENTS = 8;
const MAX_IMAGE_COUNT = 4;
const MAX_PROMPT_HISTORY = 5;
const ATTACHMENT_LIMIT_MESSAGE = `Maximum of ${MAX_ATTACHMENTS} images allowed.`;
const ATTACHMENT_TYPE_MESSAGE = "Only image files can be used for editing.";
const ATTACHMENT_READ_MESSAGE = "Unable to load one of the images you pasted or uploaded.";
const ATTACHMENT_DUPLICATE_MESSAGE = "That reference image is already attached.";
const ATTACHMENT_DUPLICATES_MESSAGE = "Duplicate reference images were skipped.";
const ATTACHMENT_PARTIAL_LIMIT_MESSAGE =
  `Only the available reference slots were added. Maximum of ${MAX_ATTACHMENTS} images allowed.`;
const ATTACHMENT_ERROR_MESSAGES = new Set([
  ATTACHMENT_LIMIT_MESSAGE,
  ATTACHMENT_TYPE_MESSAGE,
  ATTACHMENT_READ_MESSAGE,
  ATTACHMENT_DUPLICATE_MESSAGE,
  ATTACHMENT_DUPLICATES_MESSAGE,
  ATTACHMENT_PARTIAL_LIMIT_MESSAGE,
]);

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

function parseStoredCents(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseStoredStringList(value: string | null, maxItems: number): string[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();
    const items: string[] = [];

    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }

      const trimmedItem = item.trim();
      if (!trimmedItem || seen.has(trimmedItem)) {
        continue;
      }

      seen.add(trimmedItem);
      items.push(trimmedItem);

      if (items.length >= maxItems) {
        break;
      }
    }

    return items;
  } catch {
    return [];
  }
}

function parseStoredProviderPrefs(value: string | null): Record<string, ProviderPreference> {
  if (value === null) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const prefs: Record<string, ProviderPreference> = {};
    for (const [modelId, pref] of Object.entries(parsed as Record<string, unknown>)) {
      if (!pref || typeof pref !== "object") {
        continue;
      }

      const record = pref as { providerTag?: unknown; allowFallbacks?: unknown };
      if (typeof record.providerTag !== "string" || record.providerTag.length === 0) {
        continue;
      }

      prefs[modelId] = {
        providerTag: record.providerTag,
        allowFallbacks: record.allowFallbacks === true,
      };
    }

    return prefs;
  } catch {
    return {};
  }
}

function dollarsToCents(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(value * 100));
}

function getAttachmentAddNotice({
  skippedDuplicates,
  skippedForLimit,
}: {
  skippedDuplicates: number;
  skippedForLimit: number;
}): string | null {
  if (skippedForLimit > 0) {
    return ATTACHMENT_PARTIAL_LIMIT_MESSAGE;
  }

  if (skippedDuplicates > 1) {
    return ATTACHMENT_DUPLICATES_MESSAGE;
  }

  if (skippedDuplicates === 1) {
    return ATTACHMENT_DUPLICATE_MESSAGE;
  }

  return null;
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

async function ensureSerializableUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:") || typeof window === "undefined") {
    return url;
  }

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : url);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  if (isStoredAssetRef(url)) {
    try {
      const blob = await resolveStoredAssetBlob(url);
      if (!blob) {
        return url;
      }

      return await blobToDataUrl(blob);
    } catch (error) {
      console.error("Unable to resolve stored attachment for serialization", error);
      return url;
    }
  }

  if (!url.startsWith("blob:")) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob url (${response.status})`);
    }
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch (error) {
    console.error("Unable to convert blob URL for attachment", error);
    return url;
  }
}

async function resolveImageSourceBlob(source: string): Promise<Blob | null> {
  if (!source) {
    return null;
  }

  if (isStoredAssetRef(source)) {
    return resolveStoredAssetBlob(source);
  }

  try {
    const response = await fetch(source);
    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error("Unable to resolve image source blob", error);
    return null;
  }
}

export function CreatePage() {
  const [view, setView] = useState<"create" | "gallery">("create");
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>(DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<string>(DEFAULT_RESOLUTION);
  const [quality, setQuality] = useState<string>(DEFAULT_QUALITY);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultOutputFormat);
  const [imageCount, setImageCount] = useState<number>(4);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyUpdatedAt, setApiKeyUpdatedAt] = useState<string | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ImageModel[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [providerPrefs, setProviderPrefs] = useState<Record<string, ProviderPreference>>({});
  const [modelEndpoints, setModelEndpoints] = useState<ModelEndpointsState>({});
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<PromptAttachment | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<Generation[]>([]);
  const [retryingGenerationIds, setRetryingGenerationIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reuseNotice, setReuseNotice] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [spentCents, setSpentCents] = useState(0);
  const [lastGenerationCostCents, setLastGenerationCostCents] = useState<number | null>(null);
  const [lightboxSelection, setLightboxSelection] = useState<{ generationId: string; imageIndex: number } | null>(null);
  const storageHydratedRef = useRef(false);
  const pendingHydratedRef = useRef(false);
  const pendingReconciledRef = useRef(false);
  const cleanupRanRef = useRef(false);
  const endpointsRequestedRef = useRef<Set<string>>(new Set());

  const selectedModel = useMemo(
    () => modelCatalog?.find((model) => model.id === selectedModelId) ?? null,
    [modelCatalog, selectedModelId],
  );
  const selectedProviderPref = selectedModelId ? providerPrefs[selectedModelId] ?? null : null;
  const pinnedEndpoint = useMemo(() => {
    if (!selectedModelId || !selectedProviderPref?.providerTag) {
      return null;
    }

    const entry = modelEndpoints[selectedModelId];
    if (entry?.status !== "loaded") {
      return null;
    }

    return (
      entry.endpoints.find(
        (endpoint) => endpoint.provider_tag === selectedProviderPref.providerTag,
      ) ?? null
    );
  }, [modelEndpoints, selectedModelId, selectedProviderPref]);
  const activeParameters = useMemo(
    () => resolveActiveParameters(selectedModel, pinnedEndpoint),
    [pinnedEndpoint, selectedModel],
  );
  const supportedAspectRatios = useMemo(
    () => getSupportedAspectRatios(activeParameters),
    [activeParameters],
  );
  const supportedResolutions = useMemo(
    () => getSupportedResolutions(activeParameters),
    [activeParameters],
  );
  const supportedQualities = useMemo(
    () => getSupportedQualities(activeParameters),
    [activeParameters],
  );
  const referenceLimit = selectedModel
    ? getRangeMax(activeParameters ?? undefined, "input_references", 0)
    : null;

  const loadModelEndpoints = useCallback((modelId: string) => {
    if (endpointsRequestedRef.current.has(modelId)) {
      return;
    }

    endpointsRequestedRef.current.add(modelId);
    setModelEndpoints((previous) => ({
      ...previous,
      [modelId]: { status: "loading", endpoints: [] },
    }));

    fetchModelEndpoints(modelId)
      .then((endpoints) => {
        setModelEndpoints((previous) => ({
          ...previous,
          [modelId]: { status: "loaded", endpoints },
        }));
      })
      .catch((endpointsError) => {
        console.error(`Unable to load providers for ${modelId}`, endpointsError);
        endpointsRequestedRef.current.delete(modelId);
        setModelEndpoints((previous) => ({
          ...previous,
          [modelId]: { status: "error", endpoints: [] },
        }));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchImageModels()
      .then((models) => {
        if (!cancelled) {
          setModelCatalog(models);
          setCatalogError(null);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setCatalogError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load the OpenRouter model catalog.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedModelId) {
      loadModelEndpoints(selectedModelId);
    }
  }, [loadModelEndpoints, selectedModelId]);

  // Keep the selected model inside the enabled list.
  useEffect(() => {
    if (enabledModelIds.length === 0) {
      if (selectedModelId !== null) {
        setSelectedModelId(null);
      }
      return;
    }

    if (!selectedModelId || !enabledModelIds.includes(selectedModelId)) {
      setSelectedModelId(enabledModelIds[0]);
    }
  }, [enabledModelIds, selectedModelId]);

  // Clamp aspect/resolution/quality to what the active model (and pinned provider) supports.
  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    if (
      supportedAspectRatios.length > 0 &&
      aspectRatio !== AUTO_OPTION &&
      !supportedAspectRatios.includes(aspectRatio)
    ) {
      setAspectRatio(
        supportedAspectRatios.includes(DEFAULT_ASPECT_RATIO)
          ? DEFAULT_ASPECT_RATIO
          : supportedAspectRatios[0],
      );
    }

    if (supportedResolutions.length > 0 && !supportedResolutions.includes(resolution)) {
      setResolution(
        supportedResolutions.includes(DEFAULT_RESOLUTION)
          ? DEFAULT_RESOLUTION
          : supportedResolutions[supportedResolutions.length - 1],
      );
    }

    if (supportedQualities.length > 0 && !supportedQualities.includes(quality)) {
      setQuality(
        supportedQualities.includes(DEFAULT_QUALITY) ? DEFAULT_QUALITY : supportedQualities[0],
      );
    }
  }, [
    aspectRatio,
    quality,
    resolution,
    selectedModel,
    supportedAspectRatios,
    supportedQualities,
    supportedResolutions,
  ]);

  const attachmentInputImages = useMemo(
    () =>
      attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        mimeType: attachment.mimeType ?? null,
        fileSize: attachment.fileSize ?? null,
      })),
    [attachments],
  );
  const referenceAspectSource = useMemo(() => {
    const firstReference = attachmentInputImages.find(
      (image) =>
        typeof image.width === "number" &&
        Number.isFinite(image.width) &&
        image.width > 0 &&
        typeof image.height === "number" &&
        Number.isFinite(image.height) &&
        image.height > 0,
    );

    if (!firstReference?.width || !firstReference.height) {
      return null;
    }

    return {
      width: firstReference.width,
      height: firstReference.height,
    };
  }, [attachmentInputImages]);

  const budgetRemainingCents = useMemo(
    () => (budgetCents !== null ? Math.max(0, budgetCents - spentCents) : null),
    [budgetCents, spentCents],
  );
  const isBudgetLocked = budgetCents !== null && spentCents >= budgetCents;

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    handleResize();

    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const storageManager = navigator.storage;
    if (!storageManager?.persisted || !storageManager.persist) {
      return;
    }

    void (async () => {
      try {
        const alreadyPersisted = await storageManager.persisted();
        if (alreadyPersisted) {
          debugLog("storage:persisted", { persisted: true });
          return;
        }

        const granted = await storageManager.persist();
        debugLog("storage:persist-request", { granted });
      } catch (error) {
        debugLog("storage:persist-error", { error });
      }
    })();
  }, []);

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
        migrateLegacyLocalStorage();

        const storedPrompt = window.localStorage.getItem(STORAGE_KEYS.prompt);
        if (storedPrompt !== null) {
          setPrompt(storedPrompt);
        }

        const storedPromptHistory = parseStoredStringList(
          window.localStorage.getItem(STORAGE_KEYS.promptHistory),
          MAX_PROMPT_HISTORY,
        );
        if (storedPromptHistory.length > 0) {
          setPromptHistory(storedPromptHistory);
        }

        const storedAspectRatio = window.localStorage.getItem(STORAGE_KEYS.aspectRatio);
        if (storedAspectRatio === AUTO_OPTION || /^\d+:\d+$/.test(storedAspectRatio ?? "")) {
          setAspectRatio(storedAspectRatio as string);
        }

        const storedResolution = window.localStorage.getItem(STORAGE_KEYS.resolution);
        if (storedResolution !== null && storedResolution.length > 0) {
          setResolution(storedResolution);
        }

        const storedQuality = window.localStorage.getItem(STORAGE_KEYS.quality);
        if (storedQuality !== null && storedQuality.length > 0) {
          setQuality(storedQuality);
        }

        const storedOutputFormat = window.localStorage.getItem(STORAGE_KEYS.outputFormat);
        if (storedOutputFormat === "png" || storedOutputFormat === "jpeg" || storedOutputFormat === "webp") {
          setOutputFormat(storedOutputFormat);
        }

        const storedImageCount = window.localStorage.getItem(STORAGE_KEYS.imageCount);
        if (storedImageCount !== null) {
          const count = parseInt(storedImageCount, 10);
          if (Number.isFinite(count) && count >= 1 && count <= MAX_IMAGE_COUNT) {
            setImageCount(count);
          }
        }

        const storedBudgetCents = parseStoredCents(window.localStorage.getItem(STORAGE_KEYS.budgetCents));
        setBudgetCents(storedBudgetCents);

        const storedSpentCents = parseStoredCents(window.localStorage.getItem(STORAGE_KEYS.spentCents));
        setSpentCents(storedSpentCents ?? 0);

        const storedApiKey = window.localStorage.getItem(STORAGE_KEYS.apiKey);
        if (storedApiKey !== null) {
          setApiKey(storedApiKey);
        }

        const storedApiKeyUpdatedAt = window.localStorage.getItem(STORAGE_KEYS.apiKeyUpdatedAt);
        if (storedApiKeyUpdatedAt !== null && !Number.isNaN(Date.parse(storedApiKeyUpdatedAt))) {
          setApiKeyUpdatedAt(storedApiKeyUpdatedAt);
        }

        const storedEnabledModels = parseStoredStringList(
          window.localStorage.getItem(STORAGE_KEYS.enabledModels),
          200,
        );
        if (storedEnabledModels.length > 0) {
          setEnabledModelIds(storedEnabledModels);
        }

        const storedSelectedModel = window.localStorage.getItem(STORAGE_KEYS.selectedModel);
        if (storedSelectedModel !== null && storedSelectedModel.length > 0) {
          setSelectedModelId(storedSelectedModel);
        }

        setProviderPrefs(
          parseStoredProviderPrefs(window.localStorage.getItem(STORAGE_KEYS.providerPrefs)),
        );

        let generationData: Generation[] | null = null;
        let pendingData: Generation[] | null = null;

        try {
          const [restoredGenerations, restoredPending] = await Promise.all([
            restoreGenerations(),
            loadPending(),
          ]);

          if (Array.isArray(restoredGenerations)) {
            generationData = restoredGenerations;
          }

          if (Array.isArray(restoredPending)) {
            pendingData = restoredPending;
            pendingHydratedRef.current = restoredPending.length > 0;
          }
        } catch (storageError) {
          console.error("Storage restoration failed", storageError);
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
        console.error("Unable to restore Dreamint state", error);
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

    if (apiKey.trim().length === 0) {
      debugLog("pending:cleared-no-keys", {
        count: pendingGenerations.length,
      });
      setPendingGenerations([]);
      void clearPending();
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
  }, [pendingGenerations, apiKey]);

  const activeFeed = useMemo(
    () => [...pendingGenerations, ...generations],
    [generations, pendingGenerations],
  );

  const { limit: feedLimit, loadMoreRef: feedLoadMoreRef } = useInfiniteScroll({
    initialLimit: 10,
    increment: 10,
  });

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    safePersist(STORAGE_KEYS.budgetCents, budgetCents !== null ? String(budgetCents) : null);
    safePersist(STORAGE_KEYS.spentCents, String(spentCents));
  }, [budgetCents, spentCents]);

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

    safePersist(STORAGE_KEYS.promptHistory, JSON.stringify(promptHistory));
  }, [promptHistory]);

  useEffect(() => {
    if (!reuseNotice || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setReuseNotice(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [reuseNotice]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    safePersist(STORAGE_KEYS.aspectRatio, aspectRatio);
    safePersist(STORAGE_KEYS.resolution, resolution);
    safePersist(STORAGE_KEYS.quality, quality);
    safePersist(STORAGE_KEYS.outputFormat, outputFormat);
    safePersist(STORAGE_KEYS.imageCount, String(imageCount));

    const normalizedApiKey = apiKey.trim();
    safePersist(STORAGE_KEYS.apiKey, normalizedApiKey.length > 0 ? normalizedApiKey : null);
    safePersist(STORAGE_KEYS.apiKeyUpdatedAt, normalizedApiKey.length > 0 ? apiKeyUpdatedAt : null);

    safePersist(STORAGE_KEYS.enabledModels, JSON.stringify(enabledModelIds));
    safePersist(STORAGE_KEYS.selectedModel, selectedModelId);
    safePersist(
      STORAGE_KEYS.providerPrefs,
      Object.keys(providerPrefs).length > 0 ? JSON.stringify(providerPrefs) : null,
    );
  }, [
    aspectRatio,
    resolution,
    quality,
    outputFormat,
    imageCount,
    apiKey,
    apiKeyUpdatedAt,
    enabledModelIds,
    selectedModelId,
    providerPrefs,
  ]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    void persistGenerations(generations);
  }, [generations]);

  useEffect(() => {
    if (!storageHydratedRef.current || typeof window === "undefined") {
      return;
    }

    void savePending(pendingGenerations);
  }, [pendingGenerations]);

  const displayFeed = activeFeed;
  const visibleFeed = useMemo(() => displayFeed.slice(0, feedLimit), [displayFeed, feedLimit]);
  const hasGenerations = displayFeed.length > 0;
  const totalImages = useMemo(() => {
    return generations.reduce((acc, generation) => {
      const deletedSet = new Set(generation.deletedImages ?? []);
      return (
        acc +
        generation.images.reduce((count, src, index) => {
          if (!src) {
            return count;
          }
          if (deletedSet.has(index)) {
            return count;
          }
          return count + 1;
        }, 0)
      );
    }, 0);
  }, [generations]);

  const handleApiKeyChange = useCallback((value: string) => {
    setApiKey(value);
    setApiKeyUpdatedAt(value.trim().length > 0 ? new Date().toISOString() : null);
  }, []);

  const handleToggleModelEnabled = useCallback((modelId: string) => {
    setEnabledModelIds((previous) =>
      previous.includes(modelId)
        ? previous.filter((id) => id !== modelId)
        : [...previous, modelId],
    );
  }, []);

  const handleProviderPrefChange = useCallback(
    (modelId: string, pref: ProviderPreference | null) => {
      setProviderPrefs((previous) => {
        if (pref === null || pref.providerTag === null) {
          if (!(modelId in previous)) {
            return previous;
          }
          const next = { ...previous };
          delete next[modelId];
          return next;
        }

        return { ...previous, [modelId]: pref };
      });
    },
    [],
  );

  const groupedGenerations = useMemo(() => groupByDate(visibleFeed), [visibleFeed]);
  const pendingIdSet = useMemo(() => new Set(pendingGenerations.map((generation) => generation.id)), [pendingGenerations]);

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
          model: generation.model,
          modelLabel: generation.modelLabel,
          aspectRatio: generation.aspectRatio,
          resolution: generation.resolution,
          quality: generation.quality,
          outputFormat: generation.outputFormat,
          size: generation.size,
          durationMs: generation.durationMs,
          inputImages: generation.inputImages ?? [],
          usage: generation.usage,
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

  useEffect(() => {
    if (!storageHydratedRef.current || cleanupRanRef.current) {
      return;
    }
    cleanupRanRef.current = true;
    void cleanOrphanedImages(generations, pendingGenerations);
  }, [generations, pendingGenerations]);

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

      const skippedForLimit = Math.max(0, imageFiles.length - availableSlots);
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
              mimeType: file.type || null,
              fileSize: file.size,
              kind: "local" as const,
            };
          }),
        );

        const existingUrls = new Set(attachments.map((attachment) => attachment.url));
        const uniquePrepared = prepared.filter((attachment) => !existingUrls.has(attachment.url));
        const skippedDuplicates = prepared.length - uniquePrepared.length;
        const attachmentNotice = getAttachmentAddNotice({
          skippedDuplicates,
          skippedForLimit,
        });

        if (uniquePrepared.length === 0) {
          setError(attachmentNotice ?? ATTACHMENT_DUPLICATE_MESSAGE);
          return;
        }

        setAttachments((previous) => {
          const stillAvailable = MAX_ATTACHMENTS - previous.length;
          if (stillAvailable <= 0) {
            return previous;
          }

          const nextItems = uniquePrepared.slice(0, stillAvailable);
          if (nextItems.length === 0) {
            return previous;
          }

          // Match the output to the first reference by default.
          if (previous.length === 0 && nextItems[0].width && nextItems[0].height) {
            setAspectRatio(AUTO_OPTION);
          }

          return [...previous, ...nextItems];
        });

        if (attachmentNotice) {
          setError(attachmentNotice);
        } else {
          clearAttachmentError();
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

  const handleClearAttachments = useCallback(() => {
    setAttachments([]);
    setAttachmentPreview(null);
    clearAttachmentError();
  }, [clearAttachmentError]);

  const handleMoveAttachment = useCallback(
    (attachmentId: string, direction: -1 | 1) => {
      setAttachments((previous) => {
        const currentIndex = previous.findIndex((attachment) => attachment.id === attachmentId);
        if (currentIndex < 0) {
          return previous;
        }

        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= previous.length) {
          return previous;
        }

        const next = [...previous];
        [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
        return next;
      });
      clearAttachmentError();
    },
    [clearAttachmentError],
  );

  const handleAddAttachmentFromUrl = useCallback(
    async (url: string, name = "Edit input"): Promise<boolean> => {
      if (!url) {
        return false;
      }

      const resolvedUrl = await ensureSerializableUrl(url);

      if (attachments.length >= MAX_ATTACHMENTS) {
        setError(ATTACHMENT_LIMIT_MESSAGE);
        return false;
      }

      if (attachments.some((attachment) => attachment.url === resolvedUrl)) {
        setError(ATTACHMENT_DUPLICATE_MESSAGE);
        return false;
      }

      let width: number | null = null;
      let height: number | null = null;
      try {
        const dimensions = await loadImageDimensions(resolvedUrl);
        width = dimensions?.width ?? null;
        height = dimensions?.height ?? null;
      } catch (dimensionError) {
        console.error("Failed to read dimensions for attachment", dimensionError);
      }

      setAttachments((previous) => {
        const next = [
          ...previous,
          {
            id: createId("attachment"),
            name,
            url: resolvedUrl,
            kind: "remote" as const,
            width,
            height,
            mimeType: null,
            fileSize: null,
          },
        ];

        if (previous.length === 0 && width && height) {
          setAspectRatio(AUTO_OPTION);
        }

        return next;
      });
      clearAttachmentError();
      return true;
    },
    [attachments, clearAttachmentError, setError],
  );

  const handleDeletePromptHistoryItem = useCallback((historyItem: string) => {
    setPromptHistory((previous) => previous.filter((item) => item !== historyItem));
  }, []);

  const handleClearPromptHistory = useCallback(() => {
    setPromptHistory([]);
  }, []);

  const handleRestorePromptHistory = useCallback((historyItems: string[]) => {
    setPromptHistory(historyItems.slice(0, MAX_PROMPT_HISTORY));
  }, []);

  const resolvePendingSize = useCallback((): { width: number; height: number } => {
    if (aspectRatio === AUTO_OPTION && referenceAspectSource) {
      const estimated = estimateImageSize(
        `${Math.round(referenceAspectSource.width)}:${Math.round(referenceAspectSource.height)}`,
        supportedResolutions.includes(resolution) ? resolution : null,
      );
      return estimated;
    }

    return estimateImageSize(
      aspectRatio === AUTO_OPTION ? "1:1" : aspectRatio,
      supportedResolutions.includes(resolution) ? resolution : null,
    );
  }, [aspectRatio, referenceAspectSource, resolution, supportedResolutions]);

  const recordGenerationCost = useCallback((generation: Generation) => {
    const costUsd = totalUsageCostUsd(generation.usage ?? null);
    const costCents = dollarsToCents(costUsd);
    if (costCents > 0) {
      setSpentCents((previous) => previous + costCents);
      setLastGenerationCostCents(costCents);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length > 0) {
      setPromptHistory((previous) => [
        trimmedPrompt,
        ...previous.filter((item) => item !== trimmedPrompt),
      ].slice(0, MAX_PROMPT_HISTORY));
    }

    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError("Add your OpenRouter API key in settings before generating.");
      setIsSettingsOpen(true);
      return;
    }

    if (!selectedModel) {
      setError("Choose a model first — enable one or more models in settings.");
      setIsSettingsOpen(true);
      return;
    }

    if (isBudgetLocked && budgetCents !== null) {
      setError(
        `Budget limit reached: $${(spentCents / 100).toFixed(2)} of your $${(budgetCents / 100).toFixed(2)} limit is spent.`,
      );
      return;
    }

    if (attachmentInputImages.length > 0) {
      if (referenceLimit === 0) {
        setError(`${selectedModel.name} does not accept reference images.`);
        return;
      }
      if (referenceLimit !== null && attachmentInputImages.length > referenceLimit) {
        setError(
          `${selectedModel.name} accepts at most ${referenceLimit} reference image${referenceLimit === 1 ? "" : "s"}.`,
        );
        return;
      }
    }

    const supportedOutputFormats = getSupportedOutputFormats(activeParameters);
    const requestAspectRatio =
      aspectRatio !== AUTO_OPTION && supportedAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : null;
    const requestResolution = supportedResolutions.includes(resolution) ? resolution : null;
    const requestQuality = supportedQualities.includes(quality) ? quality : null;
    const requestOutputFormat = supportedOutputFormats?.includes(outputFormat)
      ? outputFormat
      : null;
    const providerPref = providerPrefs[selectedModel.id] ?? null;
    const maxImagesPerRequest = getRangeMax(activeParameters ?? undefined, "n", 1);

    const pendingId = createId("pending");
    const startedAtMs = Date.now();
    const pendingSize = resolvePendingSize();
    const inputImageSnapshot = attachmentInputImages.map((image) => ({ ...image }));

    const pendingGeneration: Generation = {
      id: pendingId,
      prompt: trimmedPrompt,
      model: selectedModel.id,
      modelLabel: selectedModel.name,
      providerTag: providerPref?.providerTag ?? null,
      allowFallbacks: providerPref ? providerPref.allowFallbacks : undefined,
      aspectRatio: requestAspectRatio ?? AUTO_OPTION,
      resolution: requestResolution,
      quality: requestQuality,
      outputFormat,
      createdAt: new Date(startedAtMs).toISOString(),
      size: pendingSize,
      images: Array(imageCount).fill(""),
      inputImages: inputImageSnapshot,
    };

    debugLog("submit:request", {
      pendingId,
      model: selectedModel.id,
      providerTag: providerPref?.providerTag ?? null,
      allowFallbacks: providerPref?.allowFallbacks ?? true,
      aspectRatio: requestAspectRatio,
      resolution: requestResolution,
      quality: requestQuality,
      imageCount,
      inputImages: inputImageSnapshot.length,
    });

    setIsSettingsOpen(false);
    setError(null);
    setPendingGenerations((previous) => [pendingGeneration, ...previous]);
    setPrompt("");
    setAttachments([]);

    const requestInputImagesPromise = Promise.all(
      inputImageSnapshot.map(async (image) => ({
        ...image,
        url: await ensureSerializableUrl(image.url),
      })),
    );

    requestInputImagesPromise
      .then((requestInputImages) =>
        generateImage({
          apiKey: trimmedApiKey,
          model: selectedModel.id,
          prompt: trimmedPrompt,
          numImages: imageCount,
          aspectRatio: requestAspectRatio,
          resolution: requestResolution,
          quality: requestQuality,
          outputFormat: requestOutputFormat,
          inputImages: requestInputImages,
          providerTag: providerPref?.providerTag ?? null,
          allowFallbacks: providerPref ? providerPref.allowFallbacks : true,
          maxImagesPerRequest,
        }),
      )
      .then(async (result) => {
        const normalizedImages = normalizeImages(result.images);
        const measuredSize = await loadImageDimensions(normalizedImages[0]);
        const generation: Generation = {
          ...pendingGeneration,
          id: createId("generation"),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          size: measuredSize ?? pendingSize,
          images: normalizedImages,
          usage: result.usage,
        };

        debugLog("generation:success", {
          pendingId,
          imageCount: normalizedImages.length,
          size: generation.size,
          costUsd: totalUsageCostUsd(result.usage),
        });

        recordGenerationCost(generation);

        let optimizedGeneration = generation;
        try {
          optimizedGeneration = await cacheGenerationAssets(generation);
        } catch (cacheError) {
          console.error("Failed to cache generation assets", cacheError);
        }

        setGenerations((previous) => [optimizedGeneration, ...previous]);
      })
      .catch((generationError: unknown) => {
        const message =
          generationError instanceof Error ? generationError.message : "Generation failed.";
        debugLog("generation:error", { pendingId, message, error: generationError });
        setError(message);
        // Restore the composer so the failed prompt is not lost.
        setPrompt(trimmedPrompt);
        setAttachments(attachments);
      })
      .finally(() => {
        setPendingGenerations((previous) => previous.filter((gen) => gen.id !== pendingId));
      });
  };

  const handleExpand = useCallback((generationId: string, imageIndex: number) => {
    setLightboxSelection({ generationId, imageIndex });
    setIsSettingsOpen(false);
    setIsDownloading(false);
  }, [setLightboxSelection, setIsSettingsOpen, setIsDownloading]);

  const handleDownload = useCallback(async (entry: GalleryEntry): Promise<boolean> => {
    setIsDownloading(true);
    try {
      const blob = await resolveImageSourceBlob(entry.src);
      if (!blob) {
        throw new Error("Download failed.");
      }
      const requestedFormat = entry.outputFormat;
      const downloadBlob = requestedFormat
        ? await convertBlobToOutputFormat(blob, requestedFormat)
        : blob;
      const url = URL.createObjectURL(downloadBlob);
      const link = document.createElement("a");
      const mimeExtension = extensionFromMimeType(downloadBlob.type);
      const format = requestedFormat ?? "png";
      const fallbackExtension = format === "jpeg" ? "jpg" : format;
      const extension = mimeExtension ?? fallbackExtension;
      link.href = url;
      link.download = `dreamint-${Date.now()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (downloadError) {
      const message =
        downloadError instanceof Error ? downloadError.message : "Unable to download image.";
      setError(message);
      return false;
    } finally {
      setIsDownloading(false);
    }
  }, [setIsDownloading, setError]);

  const getEntryForImage = useCallback((generationId: string, imageIndex: number): GalleryEntry | null => {
    const generation =
      generations.find((gen) => gen.id === generationId) ??
      pendingGenerations.find((gen) => gen.id === generationId);

    if (!generation) return null;
    const src = generation.images[imageIndex];
    if (!src) return null;

    return {
      generationId,
      imageIndex,
      src,
      prompt: generation.prompt,
      model: generation.model,
      modelLabel: generation.modelLabel,
      aspectRatio: generation.aspectRatio,
      resolution: generation.resolution,
      quality: generation.quality,
      outputFormat: generation.outputFormat,
      size: generation.size,
      durationMs: generation.durationMs,
      inputImages: generation.inputImages ?? [],
      usage: generation.usage,
    };
  }, [generations, pendingGenerations]);

  const handleDownloadImage = useCallback(async (generationId: string, imageIndex: number): Promise<boolean> => {
    const entry = getEntryForImage(generationId, imageIndex);
    if (!entry) return false;
    return await handleDownload(entry);
  }, [getEntryForImage, handleDownload]);

  const handleCopyImage = useCallback(async (generationId: string, imageIndex: number): Promise<boolean> => {
    const entry = getEntryForImage(generationId, imageIndex);
    if (!entry) return false;

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard is not supported in this browser.");
      }

      const blob = await resolveImageSourceBlob(entry.src);
      if (!blob) {
        throw new Error("Copy failed.");
      }
      const writeToClipboard = async (clipboardBlob: Blob) => {
        const type = clipboardBlob.type || "image/png";
        await navigator.clipboard.write([new ClipboardItem({ [type]: clipboardBlob })]);
      };

      // First try to write the original blob. If the browser supports its mime type,
      // this is fastest and preserves full resolution.
      try {
        await writeToClipboard(blob);
        return true;
      } catch {
        // Fall through to PNG conversion.
      }

      const MAX_CLIPBOARD_DIMENSION = 2048;
      const toPngBlob = async (input: Blob): Promise<Blob> => {
        if (typeof window === "undefined") {
          return input;
        }

        try {
          let srcWidth = 0;
          let srcHeight = 0;
          let source: CanvasImageSource | null = null;
          let bitmapToClose: ImageBitmap | null = null;

          if ("createImageBitmap" in window) {
            const bitmap = await createImageBitmap(input);
            bitmapToClose = bitmap;
            srcWidth = bitmap.width;
            srcHeight = bitmap.height;
            source = bitmap;
          } else {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              const objectUrl = URL.createObjectURL(input);
              img.decoding = "async";
              img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
              };
              img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Failed to decode image"));
              };
              img.src = objectUrl;
            });
            srcWidth = image.naturalWidth;
            srcHeight = image.naturalHeight;
            source = image;
          }

          if (!source || !srcWidth || !srcHeight) {
            bitmapToClose?.close();
            return input;
          }

          const scale = Math.min(1, MAX_CLIPBOARD_DIMENSION / Math.max(srcWidth, srcHeight));
          const targetWidth = Math.max(1, Math.round(srcWidth * scale));
          const targetHeight = Math.max(1, Math.round(srcHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            bitmapToClose?.close();
            return input;
          }
          ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
          bitmapToClose?.close();

          const pngBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );
          return pngBlob ?? input;
        } catch {
          return input;
        }
      };

      const pngBlob = await toPngBlob(blob);
      await writeToClipboard(
        pngBlob.type === "image/png" ? pngBlob : new Blob([pngBlob], { type: "image/png" }),
      );
      return true;
    } catch (copyError) {
      const message =
        copyError instanceof Error ? copyError.message : "Unable to copy image.";
      setError(message);
      return false;
    }
  }, [getEntryForImage, setError]);

  const handleShareCollage = useCallback(async (generationId: string): Promise<boolean> => {
    const generation = generations.find((gen) => gen.id === generationId);
    if (!generation) {
      return false;
    }

    const deletedSet = new Set(generation.deletedImages ?? []);
    const sources = generation.images
      .map((src, index) => {
        if (!src || deletedSet.has(index)) {
          return null;
        }
        const thumb = generation.thumbnails?.[index];
        return thumb && thumb.trim().length > 0 ? thumb : src;
      })
      .filter((src): src is string => typeof src === "string" && src.trim().length > 0)
      .slice(0, 4);

    if (sources.length === 0) {
      setError("No images available to share.");
      return false;
    }

    let resolvedSources: Array<{ originalSource: string; resolvedSource: string }> = [];

    try {
      resolvedSources = await Promise.all(
        sources.map(async (source) => {
          const resolvedSource = await resolveStoredAssetUrl(source);
          return {
            originalSource: source,
            resolvedSource,
          };
        }),
      );
      const baseWidth = Math.max(1, Math.round(generation.size?.width ?? 1024));
      const baseHeight = Math.max(1, Math.round(generation.size?.height ?? 1024));
      const maxDim = Math.max(baseWidth, baseHeight, 1);
      const maxTileDim = 1024;
      const scale = maxTileDim / maxDim;
      const tileWidth = Math.max(256, Math.round(baseWidth * scale));
      const tileHeight = Math.max(256, Math.round(baseHeight * scale));

      const blob = await createCollageBlob(
        resolvedSources.map((source) => source.resolvedSource).filter(Boolean),
        {
          tileDimensions: { width: tileWidth, height: tileHeight },
        },
      );
      if (!blob) {
        throw new Error("Unable to create collage.");
      }

      const filename = `dreamint-collage-${Date.now()}.png`;
      const file = new File([blob], filename, { type: blob.type || "image/png" });

      const canShareFiles = (() => {
        if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
          return false;
        }
        if (typeof navigator.canShare !== "function") {
          return true;
        }
        try {
          return navigator.canShare({ files: [file] });
        } catch {
          return false;
        }
      })();

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
          });
          return true;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") {
            return false;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (shareError) {
      const message =
        shareError instanceof Error ? shareError.message : "Unable to share collage.";
      setError(message);
      return false;
    } finally {
      resolvedSources.forEach(({ originalSource, resolvedSource }) => {
        if (resolvedSource.startsWith("blob:") && isStoredAssetRef(originalSource)) {
          URL.revokeObjectURL(resolvedSource);
        }
      });
    }
  }, [generations, setError]);

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
      mimeType: image.mimeType ?? null,
      fileSize: image.fileSize ?? null,
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
        setView("create");
      }
    },
    [handleAddAttachmentFromUrl, setIsDownloading, setIsSettingsOpen, setLightboxSelection, setView],
  );

  const handleRetryGeneration = useCallback(
    (generationId: string) => {
      if (retryingGenerationIds.has(generationId)) {
        return;
      }

      const generation = generations.find((gen) => gen.id === generationId);
      if (!generation) {
        return;
      }

      const trimmedApiKey = apiKey.trim();
      if (!trimmedApiKey) {
        setError("Add your OpenRouter API key in settings before retrying.");
        setIsSettingsOpen(true);
        return;
      }

      const pendingId = createId("pending");
      const numImages = Math.max(1, generation.images.length || 1);
      const inputImageSnapshot = generation.inputImages?.map((image) => ({ ...image })) ?? [];
      const startedAtMs = Date.now();
      const retryModel = modelCatalog?.find((model) => model.id === generation.model) ?? null;
      const maxImagesPerRequest = retryModel
        ? getRangeMax(retryModel.supported_parameters, "n", 1)
        : 1;

      const pendingGeneration: Generation = {
        ...generation,
        id: pendingId,
        images: Array(numImages).fill(""),
        createdAt: new Date(startedAtMs).toISOString(),
        durationMs: undefined,
        inputImages: inputImageSnapshot,
        usage: null,
      };

      debugLog("pending:retry", {
        fromId: generationId,
        pendingId,
        numImages,
        model: generation.model,
        providerTag: generation.providerTag ?? null,
      });

      setPendingGenerations((previous) => [pendingGeneration, ...previous.filter((gen) => gen.id !== pendingId)]);
      setRetryingGenerationIds((previous) => {
        const next = new Set(previous);
        next.add(generationId);
        return next;
      });
      setError(null);
      setIsSettingsOpen(false);

      const requestInputImagesPromise = Promise.all(
        inputImageSnapshot.map(async (image) => ({
          ...image,
          url: await ensureSerializableUrl(image.url),
        })),
      );

      requestInputImagesPromise
        .then((requestInputImages) =>
          generateImage({
            apiKey: trimmedApiKey,
            model: generation.model,
            prompt: generation.prompt,
            numImages,
            aspectRatio: generation.aspectRatio === AUTO_OPTION ? null : generation.aspectRatio,
            resolution: generation.resolution ?? null,
            quality: generation.quality ?? null,
            outputFormat: generation.outputFormat,
            inputImages: requestInputImages,
            providerTag: generation.providerTag ?? null,
            allowFallbacks: generation.allowFallbacks ?? true,
            maxImagesPerRequest,
          }),
        )
        .then(async (result) => {
          const normalizedImages = normalizeImages(result.images);
          const measuredSize = await loadImageDimensions(normalizedImages[0]);
          const nextGeneration: Generation = {
            ...pendingGeneration,
            id: createId("generation"),
            durationMs: Math.max(0, Date.now() - startedAtMs),
            size: measuredSize ?? pendingGeneration.size,
            images: normalizedImages,
            usage: result.usage,
          };

          debugLog("generation:success", {
            pendingId,
            imageCount: normalizedImages.length,
            size: nextGeneration.size,
          });

          recordGenerationCost(nextGeneration);

          let optimizedGeneration = nextGeneration;
          try {
            optimizedGeneration = await cacheGenerationAssets(nextGeneration);
          } catch (cacheError) {
            console.error("Failed to cache retried generation assets", cacheError);
          }

          setGenerations((previous) => [
            optimizedGeneration,
            ...previous.filter((gen) => gen.id !== generationId),
          ]);
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
          setPendingGenerations((previous) => previous.filter((gen) => gen.id !== pendingId));
          setRetryingGenerationIds((previous) => {
            const next = new Set(previous);
            next.delete(generationId);
            return next;
          });
        });
    },
    [apiKey, generations, modelCatalog, recordGenerationCost, retryingGenerationIds],
  );

  const handleDeleteGeneration = useCallback(
    (generationId: string) => {
      const generationToDelete =
        generations.find((generation) => generation.id === generationId) ??
        pendingGenerations.find((generation) => generation.id === generationId);

      void deleteGenerationData(generationId, generationToDelete);

      setGenerations((previous) => previous.filter((generation) => generation.id !== generationId));
      setPendingGenerations((previous) => previous.filter((generation) => generation.id !== generationId));
      setLightboxSelection((selection) =>
        selection && selection.generationId === generationId ? null : selection,
      );
    },
    [generations, pendingGenerations, setLightboxSelection],
  );

  const handleDeleteImage = useCallback((generationId: string, imageIndex: number) => {
    void deleteOutputImageData(generationId, imageIndex);

    setGenerations((previous) =>
      previous.map((generation) => {
        if (generation.id !== generationId) return generation;
        const deletedSet = new Set(generation.deletedImages ?? []);
        deletedSet.add(imageIndex);
        const images = [...generation.images];
        const thumbnails = generation.thumbnails ? [...generation.thumbnails] : undefined;
        images[imageIndex] = "";
        if (thumbnails) {
          thumbnails[imageIndex] = "";
        }
        return {
          ...generation,
          images,
          thumbnails,
          deletedImages: Array.from(deletedSet),
        };
      }),
    );

    setLightboxSelection((selection) =>
      selection &&
        selection.generationId === generationId &&
        selection.imageIndex === imageIndex
        ? null
        : selection,
    );
  }, []);

  const handleDeleteImages = useCallback((items: Array<{ generationId: string; imageIndex: number }>) => {
    if (items.length === 0) return;
    void Promise.allSettled(items.map((item) => deleteOutputImageData(item.generationId, item.imageIndex)));

    const grouped = items.reduce<Record<string, number[]>>((acc, item) => {
      (acc[item.generationId] ??= []).push(item.imageIndex);
      return acc;
    }, {});

    setGenerations((previous) =>
      previous.map((generation) => {
        const indexes = grouped[generation.id];
        if (!indexes) return generation;
        const deletedSet = new Set(generation.deletedImages ?? []);
        const images = [...generation.images];
        const thumbnails = generation.thumbnails ? [...generation.thumbnails] : undefined;
        indexes.forEach((index) => {
          deletedSet.add(index);
          images[index] = "";
          if (thumbnails) {
            thumbnails[index] = "";
          }
        });
        return { ...generation, images, thumbnails, deletedImages: Array.from(deletedSet) };
      }),
    );

    setLightboxSelection((selection) =>
      selection &&
        items.some(
          (item) =>
            item.generationId === selection.generationId &&
            item.imageIndex === selection.imageIndex,
        )
        ? null
        : selection,
    );
  }, []);

  const handleUsePrompt = useCallback(
    async (
      value: string,
      inputImages: Generation["inputImages"],
      options?: ReusePromptOptions,
    ) => {
      setPrompt(value);
      setIsSettingsOpen(false);

      if (options?.model) {
        setEnabledModelIds((previous) =>
          previous.includes(options.model!) ? previous : [...previous, options.model!],
        );
        setSelectedModelId(options.model);
      }
      if (options?.aspectRatio) {
        setAspectRatio(options.aspectRatio);
      }
      if (options?.resolution) {
        setResolution(options.resolution);
      }
      if (options?.quality) {
        setQuality(options.quality);
      }
      if (
        options?.outputFormat === "png" ||
        options?.outputFormat === "jpeg" ||
        options?.outputFormat === "webp"
      ) {
        setOutputFormat(options.outputFormat);
      }

      if (inputImages.length > 0) {
        const normalized = await Promise.all(
          inputImages.slice(0, MAX_ATTACHMENTS).map(async (image) => ({
            id: image.id ?? createId("attachment"),
            name: image.name ?? "Reference image",
            url: await ensureSerializableUrl(image.url),
            width: image.width ?? null,
            height: image.height ?? null,
            mimeType: image.mimeType ?? null,
            fileSize: image.fileSize ?? null,
            kind: "remote" as const,
          })),
        );

        setAttachments(normalized);
        clearAttachmentError();
      } else {
        setAttachments([]);
        setAttachmentPreview(null);
        clearAttachmentError();
      }

      const restoredFormat =
        options?.outputFormat === "jpeg" || options?.outputFormat === "png" || options?.outputFormat === "webp"
          ? options.outputFormat.toUpperCase()
          : null;
      const restoredReferenceCount = Math.min(inputImages.length, MAX_ATTACHMENTS);
      const referenceLabel =
        restoredReferenceCount === 0
          ? "no references"
          : `${restoredReferenceCount} reference${restoredReferenceCount === 1 ? "" : "s"}`;
      setReuseNotice(
        `Restored prompt${restoredFormat ? ` and ${restoredFormat} setup` : ""} with ${referenceLabel}.`,
      );
    },
    [clearAttachmentError],
  );

  const handleLightboxUsePrompt = useCallback(
    (
      prompt: string,
      inputImages: Generation["inputImages"],
      options?: ReusePromptOptions,
    ) => {
      void handleUsePrompt(prompt, inputImages, options);
      setLightboxSelection(null);
      setView("create");
    },
    [handleUsePrompt, setLightboxSelection, setView]
  );

  return (
    <div
      style={{ height: viewportHeight }}
      className="fixed inset-0 flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-6 z-50 hidden flex-col items-center gap-1 select-none 2xl:flex"
      >
        <NextImage
          src="/Dreaming.png"
          alt="Dreamint logo"
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover grayscale"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
          Dreamint
        </span>
      </div>
      <BudgetWidget
        budgetCents={budgetCents}
        spentCents={spentCents}
        budgetRemainingCents={budgetRemainingCents}
        lastGenerationCostCents={lastGenerationCostCents}
        isBudgetLocked={isBudgetLocked}
        onBudgetSave={setBudgetCents}
        onBudgetClear={() => setBudgetCents(null)}
        onResetSpending={() => setSpentCents(0)}
      />

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-8 px-6 pb-40 pt-10 lg:px-10">

          {/* Navigation Tabs */}
          <div className="pointer-events-none sticky top-4 z-30 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] p-1 border border-[var(--border-subtle)] shadow-lg shadow-black/20">
              <button
                onClick={() => setView("create")}
                className={`rounded-full px-6 py-2 text-xs font-bold uppercase tracking-wide transition-all ${view === "create"
                  ? "bg-[var(--text-primary)] text-black shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-white"
                  }`}
              >
                Create
              </button>
              <button
                onClick={() => setView("gallery")}
                className={`rounded-full px-6 py-2 text-xs font-bold uppercase tracking-wide transition-all ${view === "gallery"
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
              {error ? (
                <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-sm text-red-400 font-medium">{error}</div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Dismiss error"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ) : null}

              {reuseNotice ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Setup restored
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{reuseNotice}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReuseNotice(null)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Dismiss restored setup notice"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {hasGenerations ? (
                <>
                  {groupedGenerations.map((group) => (
                    <GenerationGroup
                      key={group.key}
                      label={group.label}
                      generations={group.items}
                      pendingIdSet={pendingIdSet}
                      retryingGenerationIds={retryingGenerationIds}
                      onExpand={handleExpand}
                      onUsePrompt={(prompt, inputImages, options) => {
                        void handleUsePrompt(prompt, inputImages, options);
                      }}
                      onPreviewInputImage={handlePreviewInputImage}
                      onDeleteGeneration={handleDeleteGeneration}
                      onDeleteImage={handleDeleteImage}
                      onDownloadImage={handleDownloadImage}
                      onCopyImage={handleCopyImage}
                      onShareCollage={handleShareCollage}
                      onRetryGeneration={handleRetryGeneration}
                    />
                  ))}
                  <div ref={feedLoadMoreRef} className="h-4 w-full" />
                </>
              ) : (
                <EmptyState />
              )}
            </main>
          ) : (
            <GalleryView
              generations={generations}
              onExpand={handleExpand}
              onDeleteImages={handleDeleteImages}
              onDeleteImage={handleDeleteImage}
              onDownloadImage={handleDownloadImage}
              onCopyImage={handleCopyImage}
            />
          )}
        </div>
      </div>

      {/* Header (Floating) */}
      {view === "create" && (
        <div className="absolute bottom-0 left-0 right-0 z-40 w-full px-6 pb-6 pt-2 pointer-events-none">
          <div className="mx-auto w-full max-w-4xl pointer-events-auto">
            <Header
              prompt={prompt}
              promptHistory={promptHistory}
              aspectRatio={aspectRatio}
              aspectRatioOptions={supportedAspectRatios}
              resolution={resolution}
              resolutionOptions={supportedResolutions}
              quality={quality}
              qualityOptions={supportedQualities}
              outputFormat={outputFormat}
              imageCount={imageCount}
              maxImageCount={MAX_IMAGE_COUNT}
              apiKey={apiKey}
              apiKeyUpdatedAt={apiKeyUpdatedAt}
              modelCatalog={modelCatalog}
              catalogError={catalogError}
              enabledModelIds={enabledModelIds}
              selectedModelId={selectedModelId}
              providerPrefs={providerPrefs}
              modelEndpoints={modelEndpoints}
              referenceLimit={referenceLimit}
              appVersion={APP_VERSION}
              totalImages={totalImages}
              isBudgetLocked={isBudgetLocked}
              isSettingsOpen={isSettingsOpen}
              onSubmit={handleSubmit}
              onPromptChange={setPrompt}
              onDeletePromptHistoryItem={handleDeletePromptHistoryItem}
              onClearPromptHistory={handleClearPromptHistory}
              onRestorePromptHistory={handleRestorePromptHistory}
              onAspectRatioChange={setAspectRatio}
              onResolutionChange={setResolution}
              onQualityChange={setQuality}
              onOutputFormatChange={setOutputFormat}
              onImageCountChange={setImageCount}
              onApiKeyChange={handleApiKeyChange}
              onModelChange={setSelectedModelId}
              onToggleModelEnabled={handleToggleModelEnabled}
              onProviderPrefChange={handleProviderPrefChange}
              onRequestEndpoints={loadModelEndpoints}
              onToggleSettings={setIsSettingsOpen}
              attachments={attachments}
              onAddAttachments={handleAddAttachments}
              onRemoveAttachment={handleRemoveAttachment}
              onClearAttachments={handleClearAttachments}
              onPreviewAttachment={handlePreviewAttachment}
              onMoveAttachment={handleMoveAttachment}
              isAttachmentLimitReached={isAttachmentLimitReached}
              maxAttachments={MAX_ATTACHMENTS}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsChangelogOpen(true)}
        className="absolute bottom-4 right-4 z-50 rounded-full border border-white/10 bg-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)] shadow-lg shadow-black/30 transition-colors hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        Changelog
      </button>

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
          onDelete={() => handleDeleteImage(lightboxEntry.generationId, lightboxEntry.imageIndex)}
          canDelete={
            !generations
              .find((gen) => gen.id === lightboxEntry.generationId)
              ?.deletedImages?.includes(lightboxEntry.imageIndex)
          }
          onUsePrompt={handleLightboxUsePrompt}
        />
      ) : null}
      {isChangelogOpen ? (
        <ChangelogModal onClose={() => setIsChangelogOpen(false)} />
      ) : null}
    </div>
  );
}
