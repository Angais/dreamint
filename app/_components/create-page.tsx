"use client";

import NextImage from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debugLog } from "./create-page/logger";
import { generateSeedream } from "../lib/generate-seedream";
import { calculateOpenAIActualCost, estimateOpenAIImageRequestCost } from "../lib/openai-image-costs";
import {
  type AspectSelection,
  DEFAULT_GEMINI_MODEL_VARIANT,
  DEFAULT_FLASH_REASONING_LEVEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_QUALITY,
  calculateOpenAIImageSize,
  calculateOpenAIImageSizeFromReferenceRatio,
  calculateOpenAIImageSizeForLongEdge,
  calculateImageSize,
  calculateImageSizeFromReferenceRatio,
  getAspectOptionsForModel,
  getOpenAIImageSizeError,
  isFlashOnlyAspect,
  normalizeOpenAIReferenceSize,
  supportsOpenAIAspect,
  type AspectKey,
  type FlashReasoningLevel,
  type GeminiModelVariant,
  type OpenAIModel,
  type OpenAIModelSelection,
  type OpenAIQuality,
  type OpenAIResolutionMode,
  type QualitySelection,
  type QualityKey,
  type Provider,
  type OutputFormat,
} from "../lib/seedream-options";
import { EmptyState } from "./create-page/empty-state";
import { GenerationGroup } from "./create-page/generation-list";
import { GalleryView } from "./create-page/gallery-view";
import { Header } from "./create-page/header";
import { Lightbox } from "./create-page/lightbox";
import { AttachmentLightbox } from "./create-page/attachment-lightbox";
import { BudgetWidget } from "./create-page/budget-widget";
import { createCollageBlob } from "./create-page/collage";
import { convertBlobToOutputFormat, extensionFromMimeType } from "./create-page/download-utils";
import { createId, groupByDate, normalizeImages } from "./create-page/utils";
import type {
  GalleryEntry,
  Generation,
  ImageThoughts,
  PromptAttachment,
  ReusePromptOptions,
} from "./create-page/types";
import { ThoughtsModal } from "./create-page/thoughts-modal";
import { cacheGenerationAssets, clearPending, loadPending, restoreGenerations, persistGenerations, savePending, deleteGenerationData, deleteOutputImageData, cleanOrphanedImages, isStoredAssetRef, resolveStoredAssetBlob, resolveStoredAssetUrl } from "./create-page/storage";
import { useInfiniteScroll } from "./create-page/use-infinite-scroll";

const defaultPrompt =
  "Cinematic shot of a futuristic city at night, neon lights, rain reflections, highly detailed, 8k resolution";
const defaultAspectKey: AspectKey = "portrait-9-16";
const defaultAspect: AspectSelection = defaultAspectKey;
const defaultQualityKey: QualityKey = "2k";
const defaultQuality: QualitySelection = defaultQualityKey;
const defaultOutputFormat: OutputFormat = "png";
const defaultOpenAIResolutionMode: OpenAIResolutionMode = "preset";
const APP_VERSION = "1.2.1";

const STORAGE_KEYS = {
  prompt: "seedream:prompt",
  aspect: "seedream:aspect",
  quality: "seedream:quality",
  provider: "seedream:provider",
  outputFormat: "seedream:output_format",
  imageCount: "seedream:image_count",
  apiKey: "seedream:api_key",
  budgetCents: "seedream:budget_cents",
  spentCents: "seedream:spent_cents",
  geminiApiKey: "seedream:gemini_api_key",
  geminiModelVariant: "seedream:gemini_model_variant",
  flashReasoningLevel: "seedream:flash_reasoning_level",
  googleSearchEnabled: "seedream:google_search_enabled",
  openAIApiKey: "seedream:openai_api_key",
  openAIModel: "seedream:openai_model",
  openAIQuality: "seedream:openai_quality",
  openAIResolutionMode: "seedream:openai_resolution_mode",
  openAICustomWidth: "seedream:openai_custom_width",
  openAICustomHeight: "seedream:openai_custom_height",
} as const;

const MAX_ATTACHMENTS = 8;
const MAX_PROMPT_HISTORY = 5;
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
  "portrait-1-2",
  "portrait-1-4",
  "portrait-1-8",
  "portrait-2-3",
  "portrait-3-4",
  "portrait-4-5",
  "portrait-9-16",
  "landscape-2-1",
  "landscape-4-1",
  "landscape-8-1",
  "landscape-3-2",
  "landscape-4-3",
  "landscape-5-4",
  "landscape-16-9",
  "landscape-21-9",
];
const ASPECT_SELECTION_VALUES: AspectSelection[] = ["auto", ...ASPECT_VALUES];
const QUALITY_VALUES: QualityKey[] = ["1k", "2k", "4k"];
const QUALITY_SELECTION_VALUES: QualitySelection[] = ["auto", ...QUALITY_VALUES];

function isAspectKey(value: string | null): value is AspectKey {
  return typeof value === "string" && (ASPECT_VALUES as string[]).includes(value);
}

function isAspectSelection(value: string | null): value is AspectSelection {
  return typeof value === "string" && (ASPECT_SELECTION_VALUES as string[]).includes(value);
}

function isQualitySelection(value: string | null): value is QualitySelection {
  return typeof value === "string" && (QUALITY_SELECTION_VALUES as string[]).includes(value);
}

function normalizeStoredOpenAIModel(value: string | null): OpenAIModelSelection | null {
  if (value === "gpt-image-2") {
    return value;
  }

  return null;
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

function parseStoredCents(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dollarsToCents(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(value * 100));
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

function parseDimensionInput(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

export function CreatePage() {
  const [view, setView] = useState<"create" | "gallery">("create");
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [aspect, setAspect] = useState<AspectSelection>(defaultAspect);
  const [quality, setQuality] = useState<QualitySelection>(defaultQuality);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultOutputFormat);
  const [provider, setProvider] = useState<Provider>("openai");
  const [geminiModelVariant, setGeminiModelVariant] =
    useState<GeminiModelVariant>(DEFAULT_GEMINI_MODEL_VARIANT);
  const [flashReasoningLevel, setFlashReasoningLevel] =
    useState<FlashReasoningLevel>(DEFAULT_FLASH_REASONING_LEVEL);
  const [imageCount, setImageCount] = useState<number>(4);
  const [apiKey, setApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openAIApiKey, setOpenAIApiKey] = useState("");
  const [openAIModel, setOpenAIModel] = useState<OpenAIModelSelection>(DEFAULT_OPENAI_MODEL);
  const [openAIQuality, setOpenAIQuality] = useState<OpenAIQuality>(DEFAULT_OPENAI_QUALITY);
  const [openAIResolutionMode, setOpenAIResolutionMode] =
    useState<OpenAIResolutionMode>(defaultOpenAIResolutionMode);
  const [openAICustomWidth, setOpenAICustomWidth] = useState("");
  const [openAICustomHeight, setOpenAICustomHeight] = useState("");
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<PromptAttachment | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<Generation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [spentCents, setSpentCents] = useState(0);
  const [lightboxSelection, setLightboxSelection] = useState<{ generationId: string; imageIndex: number } | null>(null);
  const [thoughtsToShow, setThoughtsToShow] = useState<ImageThoughts | null>(null);
  const [streamingThoughts, setStreamingThoughts] = useState<Map<string, (ImageThoughts | null)[]>>(new Map());
  const storageHydratedRef = useRef(false);
  const pendingHydratedRef = useRef(false);
  const pendingReconciledRef = useRef(false);
  const cleanupRanRef = useRef(false);
  const isOpenAIProvider = provider === "openai";
  const parsedOpenAICustomWidth = parseDimensionInput(openAICustomWidth);
  const parsedOpenAICustomHeight = parseDimensionInput(openAICustomHeight);
  const openAICustomSizeError = useMemo(() => {
    if (!isOpenAIProvider || openAIResolutionMode !== "custom") {
      return null;
    }

    if (parsedOpenAICustomWidth === null || parsedOpenAICustomHeight === null) {
      return "Enter width and height in pixels.";
    }

    return getOpenAIImageSizeError({
      width: parsedOpenAICustomWidth,
      height: parsedOpenAICustomHeight,
    });
  }, [
    isOpenAIProvider,
    openAIResolutionMode,
    parsedOpenAICustomHeight,
    parsedOpenAICustomWidth,
  ]);
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
  const canUseAutoQuality =
    isOpenAIProvider &&
    openAIResolutionMode !== "custom" &&
    aspect === "auto" &&
    referenceAspectSource !== null;
  const openAIPresetSizeLabel = useMemo(() => {
    try {
      if (aspect === "auto") {
        if (!referenceAspectSource) {
          return "Upload an image";
        }

        const resolvedSize =
          quality === "auto"
            ? normalizeOpenAIReferenceSize(referenceAspectSource)
            : calculateOpenAIImageSizeFromReferenceRatio(referenceAspectSource, quality);
        return `${resolvedSize.width}×${resolvedSize.height}`;
      }

      const presetSize = calculateOpenAIImageSize(aspect, quality === "auto" ? defaultQualityKey : quality);
      return `${presetSize.width}×${presetSize.height}`;
    } catch {
      const fallbackSize = calculateOpenAIImageSize(defaultAspectKey, defaultQualityKey);
      return `${fallbackSize.width}×${fallbackSize.height}`;
    }
  }, [aspect, quality, referenceAspectSource]);

  const resolveDraftSize = useCallback(() => {
    if (aspect === "auto") {
      if (!referenceAspectSource) {
        throw new Error("Upload an image to use Auto aspect.");
      }

      if (provider === "openai") {
        const size =
          quality === "auto"
            ? normalizeOpenAIReferenceSize(referenceAspectSource)
            : calculateOpenAIImageSizeFromReferenceRatio(referenceAspectSource, quality);

        return {
          aspect: "custom" as const,
          size,
          sizeOverride: size,
        };
      }

      if (quality === "auto") {
        throw new Error("Auto quality is only available with OpenAI when Auto aspect is selected.");
      }

      const size = calculateImageSizeFromReferenceRatio(referenceAspectSource, quality);
      return {
        aspect: "custom" as const,
        size,
        sizeOverride: size,
      };
    }

    if (provider === "openai") {
      if (openAIResolutionMode === "custom") {
        if (parsedOpenAICustomWidth === null || parsedOpenAICustomHeight === null) {
          throw new Error("Enter width and height in pixels.");
        }

        const size = {
          width: parsedOpenAICustomWidth,
          height: parsedOpenAICustomHeight,
        };
        const sizeError = getOpenAIImageSizeError(size);
        if (sizeError) {
          throw new Error(sizeError);
        }

        return {
          aspect: "custom" as const,
          size,
          sizeOverride: size,
        };
      }

      const presetSize = calculateOpenAIImageSize(aspect, quality === "auto" ? defaultQualityKey : quality);
      return {
        aspect,
        size: presetSize,
        sizeOverride: undefined,
      };
    }

    if (quality === "auto") {
      throw new Error("Auto quality is only available with OpenAI when Auto aspect is selected.");
    }

    return {
      aspect,
      size: calculateImageSize(aspect, quality),
      sizeOverride: undefined,
    };
  }, [
    aspect,
    openAIResolutionMode,
    parsedOpenAICustomHeight,
    parsedOpenAICustomWidth,
    provider,
    quality,
    referenceAspectSource,
  ]);
  const estimatedOpenAICost = useMemo(() => {
    if (!isOpenAIProvider) {
      return null;
    }

    try {
      const draftSize = resolveDraftSize();
      return estimateOpenAIImageRequestCost({
        prompt,
        size: draftSize.size,
        quality: openAIQuality,
        imageCount,
        inputImages: attachmentInputImages,
      });
    } catch {
      return null;
    }
  }, [
    attachmentInputImages,
    imageCount,
    isOpenAIProvider,
    openAIQuality,
    prompt,
    resolveDraftSize,
  ]);
  const batchCostCents = useMemo(
    () => dollarsToCents(estimatedOpenAICost?.totalCostUsd),
    [estimatedOpenAICost],
  );
  const budgetRemainingCents = useMemo(
    () => (budgetCents !== null ? Math.max(0, budgetCents - spentCents) : null),
    [budgetCents, spentCents],
  );
  const isBudgetLocked = useMemo(() => {
    if (budgetCents === null) {
      return false;
    }

    if (spentCents >= budgetCents) {
      return true;
    }

    return batchCostCents > 0 && spentCents + batchCostCents > budgetCents;
  }, [batchCostCents, budgetCents, spentCents]);

  const applyAttachmentSizing = useCallback(
    () => {
      setAspect("auto");
      if (provider === "openai") {
        setOpenAIResolutionMode("preset");
        setQuality("auto");
      }
    },
    [provider],
  );

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
        const storedPrompt = window.localStorage.getItem(STORAGE_KEYS.prompt);
        if (storedPrompt !== null) {
          setPrompt(storedPrompt);
        }

        const storedAspect = window.localStorage.getItem(STORAGE_KEYS.aspect);
        if (isAspectSelection(storedAspect)) {
          setAspect(storedAspect);
        }

        const storedQuality = window.localStorage.getItem(STORAGE_KEYS.quality);
        if (isQualitySelection(storedQuality)) {
          setQuality(storedQuality);
        }

        setProvider("openai");

        const storedGeminiModelVariant = window.localStorage.getItem(STORAGE_KEYS.geminiModelVariant);
        if (storedGeminiModelVariant === "pro" || storedGeminiModelVariant === "flash") {
          setGeminiModelVariant(storedGeminiModelVariant);
        }
        const storedFlashReasoningLevel = window.localStorage.getItem(STORAGE_KEYS.flashReasoningLevel);
        if (storedFlashReasoningLevel === "minimal" || storedFlashReasoningLevel === "high") {
          setFlashReasoningLevel(storedFlashReasoningLevel);
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

        const storedBudgetCents = parseStoredCents(window.localStorage.getItem(STORAGE_KEYS.budgetCents));
        setBudgetCents(storedBudgetCents);

        const storedSpentCents = parseStoredCents(window.localStorage.getItem(STORAGE_KEYS.spentCents));
        setSpentCents(storedSpentCents ?? 0);

        const storedGeminiApiKey = window.localStorage.getItem(STORAGE_KEYS.geminiApiKey);
        if (storedGeminiApiKey !== null) {
          setGeminiApiKey(storedGeminiApiKey);
        }

        const storedOpenAIApiKey = window.localStorage.getItem(STORAGE_KEYS.openAIApiKey);
        if (storedOpenAIApiKey !== null) {
          setOpenAIApiKey(storedOpenAIApiKey);
        }

        const storedOpenAIModel = normalizeStoredOpenAIModel(window.localStorage.getItem(STORAGE_KEYS.openAIModel));
        if (storedOpenAIModel) {
          setOpenAIModel(storedOpenAIModel);
        }

        const storedOpenAIQuality = window.localStorage.getItem(STORAGE_KEYS.openAIQuality);
        if (storedOpenAIQuality === "low" || storedOpenAIQuality === "medium" || storedOpenAIQuality === "high") {
          setOpenAIQuality(storedOpenAIQuality);
        }

        const storedOpenAIResolutionMode = window.localStorage.getItem(STORAGE_KEYS.openAIResolutionMode);
        if (storedOpenAIResolutionMode === "preset" || storedOpenAIResolutionMode === "custom") {
          setOpenAIResolutionMode(storedOpenAIResolutionMode);
        }

        const storedOpenAICustomWidth = window.localStorage.getItem(STORAGE_KEYS.openAICustomWidth);
        if (storedOpenAICustomWidth !== null) {
          setOpenAICustomWidth(storedOpenAICustomWidth);
        }

        const storedOpenAICustomHeight = window.localStorage.getItem(STORAGE_KEYS.openAICustomHeight);
        if (storedOpenAICustomHeight !== null) {
          setOpenAICustomHeight(storedOpenAICustomHeight);
        }

        const storedGoogleSearch = window.localStorage.getItem(STORAGE_KEYS.googleSearchEnabled);
        if (storedGoogleSearch === "true") {
          setUseGoogleSearch(true);
        }

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
                modelVariant:
                  generation.provider === "openai"
                    ? generation.modelVariant
                    : generation.modelVariant ?? DEFAULT_GEMINI_MODEL_VARIANT,
                openAIModel: generation.openAIModel ?? DEFAULT_OPENAI_MODEL,
                openAIQuality: generation.openAIQuality ?? DEFAULT_OPENAI_QUALITY,
              })),
            );
          }
          if (pendingData) {
            setPendingGenerations(
              pendingData.map((pending) => ({
                ...pending,
                outputFormat: pending.outputFormat ?? defaultOutputFormat,
                modelVariant:
                  pending.provider === "openai"
                    ? pending.modelVariant
                    : pending.modelVariant ?? DEFAULT_GEMINI_MODEL_VARIANT,
                openAIModel: pending.openAIModel ?? DEFAULT_OPENAI_MODEL,
                openAIQuality: pending.openAIQuality ?? DEFAULT_OPENAI_QUALITY,
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

    const noKeys =
      apiKey.trim().length === 0 &&
      geminiApiKey.trim().length === 0 &&
      openAIApiKey.trim().length === 0;
    if (noKeys) {
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
  }, [pendingGenerations, apiKey, geminiApiKey, openAIApiKey]);

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

    safePersist(STORAGE_KEYS.aspect, aspect);
    safePersist(STORAGE_KEYS.quality, quality);
    safePersist(STORAGE_KEYS.outputFormat, outputFormat);
    safePersist(STORAGE_KEYS.provider, provider);
    safePersist(STORAGE_KEYS.geminiModelVariant, geminiModelVariant);
    safePersist(STORAGE_KEYS.flashReasoningLevel, flashReasoningLevel);
    safePersist(STORAGE_KEYS.imageCount, String(imageCount));
    safePersist(STORAGE_KEYS.googleSearchEnabled, useGoogleSearch ? "true" : null);

    const normalizedApiKey = apiKey.trim();
    safePersist(STORAGE_KEYS.apiKey, normalizedApiKey.length > 0 ? normalizedApiKey : null);

    const normalizedGeminiApiKey = geminiApiKey.trim();
    safePersist(STORAGE_KEYS.geminiApiKey, normalizedGeminiApiKey.length > 0 ? normalizedGeminiApiKey : null);

    const normalizedOpenAIApiKey = openAIApiKey.trim();
    safePersist(STORAGE_KEYS.openAIApiKey, normalizedOpenAIApiKey.length > 0 ? normalizedOpenAIApiKey : null);
    safePersist(STORAGE_KEYS.openAIModel, openAIModel);
    safePersist(STORAGE_KEYS.openAIQuality, openAIQuality);
    safePersist(STORAGE_KEYS.openAIResolutionMode, openAIResolutionMode);
    safePersist(STORAGE_KEYS.openAICustomWidth, openAICustomWidth.trim().length > 0 ? openAICustomWidth.trim() : null);
    safePersist(STORAGE_KEYS.openAICustomHeight, openAICustomHeight.trim().length > 0 ? openAICustomHeight.trim() : null);

  }, [
    aspect,
    quality,
    outputFormat,
    provider,
    geminiModelVariant,
    flashReasoningLevel,
    imageCount,
    apiKey,
    geminiApiKey,
    openAIApiKey,
    openAIModel,
    openAIQuality,
    openAIResolutionMode,
    openAICustomWidth,
    openAICustomHeight,
    useGoogleSearch,
  ]);

  useEffect(() => {
    if (aspect === "auto") {
      return;
    }

    const flashCompatible = provider === "gemini" && geminiModelVariant === "flash";

    if (provider === "openai") {
      if (supportsOpenAIAspect(aspect)) {
        return;
      }

      const fallbackAspect = getAspectOptionsForModel(provider, geminiModelVariant)
        .find((option) => option.value === defaultAspectKey)?.value ?? defaultAspectKey;
      setAspect(fallbackAspect);
      return;
    }

    if (flashCompatible) {
      return;
    }

    if (!isFlashOnlyAspect(aspect)) {
      return;
    }

    const fallbackAspect = getAspectOptionsForModel(provider, geminiModelVariant)
      .find((option) => option.value === defaultAspectKey)?.value ?? defaultAspectKey;
    setAspect(fallbackAspect);
  }, [provider, geminiModelVariant, aspect]);

  useEffect(() => {
    if (provider === "openai" && openAIResolutionMode === "custom" && (aspect === "auto" || quality === "auto")) {
      setOpenAIResolutionMode("preset");
    }
  }, [aspect, openAIResolutionMode, provider, quality]);

  useEffect(() => {
    if (quality !== "auto") {
      return;
    }

    if (canUseAutoQuality) {
      return;
    }

    setQuality(defaultQuality);
  }, [canUseAutoQuality, quality]);

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

  const handleAspectSelect = useCallback(
    (value: string) => {
      if (!isAspectSelection(value)) {
        return;
      }

      if (value === "auto") {
        if (provider === "openai") {
          setOpenAIResolutionMode("preset");
        }
        setAspect("auto");
        return;
      }

      if (provider === "openai" && openAIResolutionMode === "custom") {
          const currentWidth = parseDimensionInput(openAICustomWidth);
          const currentHeight = parseDimensionInput(openAICustomHeight);
          const fallbackSize = calculateOpenAIImageSize(
            value,
            quality === "auto" ? defaultQualityKey : quality,
          );
          const currentLongEdge =
            currentWidth !== null && currentHeight !== null
              ? Math.max(currentWidth, currentHeight)
              : Math.max(fallbackSize.width, fallbackSize.height);

          try {
            const recalculatedSize = calculateOpenAIImageSizeForLongEdge(value, currentLongEdge);
            setOpenAICustomWidth(String(recalculatedSize.width));
            setOpenAICustomHeight(String(recalculatedSize.height));
          } catch {
            setOpenAICustomWidth(String(fallbackSize.width));
            setOpenAICustomHeight(String(fallbackSize.height));
          }
        }

        if (quality === "auto") {
          setQuality(defaultQualityKey);
        }
        setAspect(value);
    },
    [openAICustomHeight, openAICustomWidth, openAIResolutionMode, provider, quality],
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
          aspect: generation.aspect,
          quality: generation.quality,
          durationMs: generation.durationMs,
          aspectSelection: generation.aspectSelection,
          qualitySelection: generation.qualitySelection,
          provider: generation.provider,
          modelVariant: generation.modelVariant,
          openAIModel: generation.openAIModel,
          openAIQuality: generation.openAIQuality,
          estimatedOpenAICost: generation.estimatedOpenAICost,
          openAIUsage: generation.openAIUsage,
          outputFormat: generation.outputFormat,
          size: generation.size,
          inputImages: generation.inputImages ?? [],
          useGoogleSearch: generation.useGoogleSearch,
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
          // All images were duplicates, silently ignore
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

          // Auto-set aspect/size based on first attachment if it's the first batch
          if (previous.length === 0 && nextItems[0].width && nextItems[0].height) {
            applyAttachmentSizing();
          }

          return [...previous, ...nextItems];
        });

        clearAttachmentError();
      } catch (attachmentError) {
        console.error("Failed to read attachment", attachmentError);
        setError(ATTACHMENT_READ_MESSAGE);
      }
    },
    [applyAttachmentSizing, attachments, clearAttachmentError, setError],
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

      const resolvedUrl = await ensureSerializableUrl(url);

      if (attachments.length >= MAX_ATTACHMENTS) {
        setError(ATTACHMENT_LIMIT_MESSAGE);
        return false;
      }

      if (attachments.some((attachment) => attachment.url === resolvedUrl)) {
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
          { id: createId("attachment"), name, url: resolvedUrl, kind: "remote" as const, width, height },
        ];

        if (previous.length === 0 && width && height) {
          applyAttachmentSizing();
        }

        return next;
      });
      clearAttachmentError();
      return true;
    },
    [applyAttachmentSizing, attachments, clearAttachmentError, setError],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length > 0) {
      setPromptHistory((previous) =>
        [trimmedPrompt, ...previous].slice(0, MAX_PROMPT_HISTORY),
      );
    }

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

    let draftSize;
    try {
      draftSize = resolveDraftSize();
    } catch (sizeError) {
      const message = sizeError instanceof Error ? sizeError.message : "Invalid image size.";
      setError(message);
      return;
    }

    const pendingSize = draftSize.size;
    const inputImageSnapshot = attachmentInputImages.map((image) => ({ ...image }));
    const estimatedRequestCost =
      provider === "openai"
        ? estimateOpenAIImageRequestCost({
            prompt,
            size: pendingSize,
            quality: openAIQuality,
            imageCount,
            inputImages: inputImageSnapshot,
          })
        : null;
    const requestCostCents = dollarsToCents(estimatedRequestCost?.totalCostUsd);
    if (budgetCents !== null && (spentCents >= budgetCents || (requestCostCents > 0 && spentCents + requestCostCents > budgetCents))) {
      setError(
        `Budget limit reached. This batch would bring spending to $${((spentCents + requestCostCents) / 100).toFixed(2)} of your $${(budgetCents / 100).toFixed(2)} limit.`,
      );
      return;
    }

    const enableGoogleSearch = provider === "gemini" && useGoogleSearch;
    const effectiveModelVariant =
      provider === "openai" ? undefined : geminiModelVariant;
    const requestedOpenAIModels: OpenAIModel[] =
      provider === "openai" ? [openAIModel] : [];
    const generationTargets =
      provider === "openai"
        ? requestedOpenAIModels.map((model) => ({
            pendingId: createId("pending"),
            openAIModel: model,
            startedAtMs: Date.now(),
          }))
        : [
            {
              pendingId: createId("pending"),
              openAIModel: undefined,
              startedAtMs: Date.now(),
            },
          ];
    const requestQuality: QualityKey = quality === "auto" ? defaultQualityKey : quality;

    const pendingGenerationsToQueue: Generation[] = generationTargets.map((target) => ({
      id: target.pendingId,
      prompt,
      aspect: draftSize.aspect,
      quality: requestQuality,
      aspectSelection: aspect,
      qualitySelection: quality,
      outputFormat,
      provider,
      modelVariant: effectiveModelVariant,
      openAIModel: target.openAIModel,
      openAIQuality: provider === "openai" ? openAIQuality : undefined,
      estimatedOpenAICost: estimatedRequestCost ?? undefined,
      useGoogleSearch: enableGoogleSearch,
      size: pendingSize,
      createdAt: new Date(target.startedAtMs).toISOString(),
      inputImages: inputImageSnapshot,
      images: Array(imageCount).fill(""),
    }));

    setIsSettingsOpen(false);
    setError(null);
    setPendingGenerations((previous) => {
      const next = [...pendingGenerationsToQueue, ...previous];
      debugLog("pending:queued", {
        pendingIds: pendingGenerationsToQueue.map((generation) => generation.id),
        pendingCount: next.length,
      });
      return next;
    });

    setPrompt("");
    setAttachments([]);

    const trimmedApiKey = apiKey.trim();
    const trimmedGeminiApiKey = geminiApiKey.trim();
    const trimmedOpenAIApiKey = openAIApiKey.trim();

    debugLog("submit:request", {
      pendingIds: generationTargets.map((target) => target.pendingId),
      provider,
      apiKeyProvided: trimmedApiKey.length > 0,
      geminiApiKeyProvided: trimmedGeminiApiKey.length > 0,
      openAIApiKeyProvided: trimmedOpenAIApiKey.length > 0,
      inputImages: inputImageSnapshot.length,
      imageCount,
      googleSearch: enableGoogleSearch,
      modelVariant: effectiveModelVariant,
      openAIModel: provider === "openai" ? openAIModel : null,
      openAIModelsRequested: requestedOpenAIModels,
      openAIQuality: provider === "openai" ? openAIQuality : null,
      size: pendingSize,
    });

    // Initialize streaming thoughts for each pending generation
    setStreamingThoughts((prev) => {
      const next = new Map(prev);
      for (const target of generationTargets) {
        next.set(target.pendingId, Array(imageCount).fill(null));
      }
      return next;
    });

    const requestInputImagesPromise = Promise.all(
      inputImageSnapshot.map(async (image) => ({
        ...image,
        url: await ensureSerializableUrl(image.url),
      })),
    );

    let completedRequests = 0;
    let successfulRequests = 0;
    const totalRequests = generationTargets.length;

    const finishRequest = (pendingId: string) => {
      completedRequests += 1;

      setPendingGenerations((previous) => {
        const next = previous.filter((generation) => generation.id !== pendingId);
        debugLog("pending:cleared", {
          pendingId,
          before: previous.length,
          after: next.length,
        });
        return next;
      });

      setStreamingThoughts((prev) => {
        const next = new Map(prev);
        next.delete(pendingId);
        return next;
      });

      if (completedRequests === totalRequests && successfulRequests === 0) {
        setPrompt(prompt);
        setAttachments(attachments);
      }
    };

    generationTargets.forEach((target) => {
      const generationPromise = requestInputImagesPromise.then((requestInputImages) =>
        generateSeedream({
          prompt,
          aspect: draftSize.aspect,
          quality: requestQuality,
          numImages: imageCount,
          provider,
          modelVariant: effectiveModelVariant,
          openAIModel: target.openAIModel,
          openAIQuality,
          flashReasoningLevel,
          outputFormat,
          apiKey: trimmedApiKey.length > 0 ? trimmedApiKey : undefined,
          geminiApiKey: trimmedGeminiApiKey.length > 0 ? trimmedGeminiApiKey : undefined,
          openAIApiKey: trimmedOpenAIApiKey.length > 0 ? trimmedOpenAIApiKey : undefined,
          sizeOverride: draftSize.sizeOverride,
          useGoogleSearch: enableGoogleSearch,
          inputImages: requestInputImages,
          onThoughtsUpdate: (imageIndex, thoughts) => {
            setStreamingThoughts((prev) => {
              const next = new Map(prev);
              const currentThoughts = next.get(target.pendingId) ?? Array(imageCount).fill(null);
              const updatedThoughts = [...currentThoughts];
              updatedThoughts[imageIndex] = thoughts;
              next.set(target.pendingId, updatedThoughts);
              return next;
            });
          },
        }),
      );

      generationPromise
        .then(async (result) => {
          successfulRequests += 1;

          debugLog("generation:success", {
            pendingId: target.pendingId,
            rawImageCount: result.images.length,
            size: result.size,
            openAIModel: target.openAIModel,
          });

          const normalizedImages = normalizeImages(result.images);
          debugLog("generation:normalized", {
            pendingId: target.pendingId,
            normalizedCount: normalizedImages.length,
            urlsSample: normalizedImages.slice(0, 8),
          });

          const generation: Generation = {
            ...result,
            id: createId("generation"),
            durationMs: Math.max(0, Date.now() - target.startedAtMs),
            images: normalizedImages,
            aspectSelection: aspect,
            qualitySelection: quality,
            estimatedOpenAICost: estimatedRequestCost ?? undefined,
          };
          const actualCost = calculateOpenAIActualCost(generation.openAIUsage ?? null);
          const generationCostCents = dollarsToCents(
            actualCost.totalCostUsd ?? estimatedRequestCost?.totalCostUsd,
          );
          if (provider === "openai" && generationCostCents > 0) {
            setSpentCents((previous) => previous + generationCostCents);
          }

          let optimizedGeneration = generation;
          try {
            optimizedGeneration = await cacheGenerationAssets(generation);
          } catch (cacheError) {
            console.error("Failed to cache generation assets", cacheError);
          }

          setGenerations((previous) => {
            const next = [optimizedGeneration, ...previous];
            debugLog("generations:prepended", {
              generationId: optimizedGeneration.id,
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
          const scopedMessage =
            provider === "openai" && totalRequests > 1 && target.openAIModel
              ? `${target.openAIModel}: ${message}`
              : message;
          debugLog("generation:error", {
            pendingId: target.pendingId,
            message: scopedMessage,
            error: generationError,
            openAIModel: target.openAIModel,
          });
          setError(scopedMessage);
        })
        .finally(() => {
          finishRequest(target.pendingId);
        });
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
      const blob = await resolveStoredAssetBlob(entry.src);
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
      aspect: generation.aspect,
      quality: generation.quality,
      durationMs: generation.durationMs,
      aspectSelection: generation.aspectSelection,
      qualitySelection: generation.qualitySelection,
      provider: generation.provider,
      modelVariant: generation.modelVariant,
      openAIModel: generation.openAIModel,
      openAIQuality: generation.openAIQuality,
      estimatedOpenAICost: generation.estimatedOpenAICost,
      openAIUsage: generation.openAIUsage,
      outputFormat: generation.outputFormat,
      size: generation.size,
      inputImages: generation.inputImages ?? [],
      useGoogleSearch: generation.useGoogleSearch,
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

      const blob = await resolveStoredAssetBlob(entry.src);
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
      await writeToClipboard(new Blob([pngBlob], { type: "image/png" }));
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
      const generation = generations.find((gen) => gen.id === generationId);
      if (!generation) {
        return;
      }

      const pendingId = createId("pending");
      const numImages = Math.max(1, generation.images.length || 1);
      const pendingSize =
        generation.aspect === "custom" && generation.size
          ? generation.size
          : generation.provider === "openai"
          ? calculateOpenAIImageSize(generation.aspect as AspectKey, generation.quality)
          : calculateImageSize(generation.aspect as AspectKey, generation.quality);
      const inputImageSnapshot = generation.inputImages?.map((image) => ({ ...image })) ?? [];
      const enableGoogleSearch =
        generation.provider === "gemini" && Boolean(generation.useGoogleSearch);
      const retryModelVariant =
        generation.provider === "gemini"
          ? generation.modelVariant ?? DEFAULT_GEMINI_MODEL_VARIANT
          : generation.provider === "fal"
          ? generation.modelVariant ?? DEFAULT_GEMINI_MODEL_VARIANT
          : undefined;
      const startedAtMs = Date.now();

      const pendingGeneration: Generation = {
        ...generation,
        id: pendingId,
        images: Array(numImages).fill(""),
        createdAt: new Date(startedAtMs).toISOString(),
        durationMs: undefined,
        inputImages: inputImageSnapshot,
        size: pendingSize,
        outputFormat: generation.outputFormat ?? defaultOutputFormat,
        useGoogleSearch: enableGoogleSearch,
        modelVariant: retryModelVariant,
        openAIModel: generation.openAIModel ?? DEFAULT_OPENAI_MODEL,
        openAIQuality: generation.openAIQuality ?? DEFAULT_OPENAI_QUALITY,
        aspectSelection: generation.aspectSelection,
        qualitySelection: generation.qualitySelection,
      };

      debugLog("pending:retry", {
        fromId: generationId,
        pendingId,
        numImages,
        aspect: generation.aspect,
        quality: generation.quality,
        provider: generation.provider,
        modelVariant: retryModelVariant,
        openAIModel: generation.openAIModel ?? DEFAULT_OPENAI_MODEL,
        openAIQuality: generation.openAIQuality ?? DEFAULT_OPENAI_QUALITY,
        inputImages: inputImageSnapshot.length,
      });

      setGenerations((previous) => previous.filter((gen) => gen.id !== generationId));
      setPendingGenerations((previous) => [pendingGeneration, ...previous.filter((gen) => gen.id !== pendingId)]);
      setError(null);
      setIsSettingsOpen(false);

      const requestInputImagesPromise = Promise.all(
        inputImageSnapshot.map(async (image) => ({
          ...image,
          url: await ensureSerializableUrl(image.url),
        })),
      );

      const generationPromise = requestInputImagesPromise.then((requestInputImages) =>
        generateSeedream({
          prompt: generation.prompt,
          aspect: generation.aspect,
          quality: generation.quality,
          numImages,
          provider: generation.provider,
          modelVariant: retryModelVariant,
          openAIModel: generation.openAIModel ?? DEFAULT_OPENAI_MODEL,
          openAIQuality: generation.openAIQuality ?? DEFAULT_OPENAI_QUALITY,
          flashReasoningLevel,
          outputFormat: generation.outputFormat ?? defaultOutputFormat,
          apiKey: apiKey.trim() || undefined,
          geminiApiKey: geminiApiKey.trim() || undefined,
          openAIApiKey: openAIApiKey.trim() || undefined,
          sizeOverride: generation.aspect === "custom" ? generation.size : undefined,
          useGoogleSearch: enableGoogleSearch,
          inputImages: requestInputImages,
        }),
      );

      generationPromise
        .then(async (result) => {
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
            durationMs: Math.max(0, Date.now() - startedAtMs),
            images: normalizedImages,
            aspectSelection: generation.aspectSelection,
            qualitySelection: generation.qualitySelection,
          };

          let optimizedGeneration = nextGeneration;
          try {
            optimizedGeneration = await cacheGenerationAssets(nextGeneration);
          } catch (cacheError) {
            console.error("Failed to cache retried generation assets", cacheError);
          }

          setGenerations((previous) => {
            const next = [optimizedGeneration, ...previous];
            debugLog("generations:prepended", {
              generationId: optimizedGeneration.id,
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
    [apiKey, flashReasoningLevel, geminiApiKey, generations, openAIApiKey],
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

      setProvider("openai");
      if (typeof options?.useGoogleSearch === "boolean") {
        setUseGoogleSearch(options.useGoogleSearch);
      }
      if (options?.modelVariant === "pro" || options?.modelVariant === "flash") {
        setGeminiModelVariant(options.modelVariant);
      }
      const normalizedOpenAIModel = normalizeStoredOpenAIModel(options?.openAIModel ?? null);
      if (normalizedOpenAIModel) {
        setOpenAIModel(normalizedOpenAIModel);
      }
      if (options?.openAIQuality === "low" || options?.openAIQuality === "medium" || options?.openAIQuality === "high") {
        setOpenAIQuality(options.openAIQuality);
      }

      if (options?.aspectSelection && isAspectSelection(options.aspectSelection)) {
        setAspect(options.aspectSelection);
      } else if (options?.aspect && options.aspect !== "custom" && isAspectKey(options.aspect)) {
        setAspect(options.aspect);
      }

      if (options?.qualitySelection && isQualitySelection(options.qualitySelection)) {
        setQuality(options.qualitySelection);
      }

      if (
        options?.provider === "openai" &&
        !options?.aspectSelection &&
        !options?.qualitySelection &&
        options.size &&
        options.aspect === "custom"
      ) {
        setOpenAIResolutionMode("custom");
        setOpenAICustomWidth(String(options.size.width));
        setOpenAICustomHeight(String(options.size.height));
      } else if (options?.provider === "openai") {
        setOpenAIResolutionMode("preset");
      }

      if (inputImages.length > 0) {
        const normalized = await Promise.all(
          inputImages.slice(0, MAX_ATTACHMENTS).map(async (image) => ({
            id: image.id ?? createId("attachment"),
            name: image.name ?? "Reference image",
            url: await ensureSerializableUrl(image.url),
            width: image.width ?? null,
            height: image.height ?? null,
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
    },
    [clearAttachmentError, setUseGoogleSearch],
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
          alt="Dreamint (GPT) logo"
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover grayscale"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
          Dreamint (GPT)
        </span>
      </div>
      <BudgetWidget
        budgetCents={budgetCents}
        spentCents={spentCents}
        budgetRemainingCents={budgetRemainingCents}
        batchCostCents={batchCostCents}
        imagesPerBatch={imageCount}
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

              {hasGenerations ? (
                <>
                  {groupedGenerations.map((group) => (
                    <GenerationGroup
                      key={group.key}
                      label={group.label}
                      generations={group.items}
                      pendingIdSet={pendingIdSet}
                      streamingThoughts={streamingThoughts}
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
                      onShowThoughts={setThoughtsToShow}
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
              aspect={aspect}
              quality={quality}
              outputFormat={outputFormat}
              provider={provider}
              geminiModelVariant={geminiModelVariant}
              openAIModel={openAIModel}
              openAIQuality={openAIQuality}
              openAIApiKey={openAIApiKey}
              openAIResolutionMode={openAIResolutionMode}
              openAICustomWidth={openAICustomWidth}
              openAICustomHeight={openAICustomHeight}
              openAICustomSizeError={openAICustomSizeError}
              openAIPresetSizeLabel={openAIPresetSizeLabel}
              estimatedOpenAICost={estimatedOpenAICost}
              flashReasoningLevel={flashReasoningLevel}
              useGoogleSearch={useGoogleSearch}
              imageCount={imageCount}
              apiKey={apiKey}
              geminiApiKey={geminiApiKey}
              appVersion={APP_VERSION}
              totalImages={totalImages}
              isBudgetLocked={isBudgetLocked}
              isSettingsOpen={isSettingsOpen}
              onSubmit={handleSubmit}
              onPromptChange={setPrompt}
              onAspectSelect={handleAspectSelect}
              onQualityChange={setQuality}
              onOutputFormatChange={setOutputFormat}
              onProviderChange={setProvider}
              onGeminiModelVariantChange={setGeminiModelVariant}
              onOpenAIModelChange={setOpenAIModel}
              onOpenAIQualityChange={setOpenAIQuality}
              onOpenAIApiKeyChange={setOpenAIApiKey}
              onOpenAIResolutionModeChange={setOpenAIResolutionMode}
              onOpenAICustomWidthChange={setOpenAICustomWidth}
              onOpenAICustomHeightChange={setOpenAICustomHeight}
              onFlashReasoningLevelChange={setFlashReasoningLevel}
              onToggleGoogleSearch={setUseGoogleSearch}
              onImageCountChange={setImageCount}
              onApiKeyChange={setApiKey}
              onGeminiApiKeyChange={setGeminiApiKey}
              onToggleSettings={setIsSettingsOpen}
              attachments={attachments}
              onAddAttachments={handleAddAttachments}
              onRemoveAttachment={handleRemoveAttachment}
              onPreviewAttachment={handlePreviewAttachment}
              isAttachmentLimitReached={isAttachmentLimitReached}
              canUseAutoQuality={canUseAutoQuality}
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
          onDelete={() => handleDeleteImage(lightboxEntry.generationId, lightboxEntry.imageIndex)}
          canDelete={
            !generations
              .find((gen) => gen.id === lightboxEntry.generationId)
              ?.deletedImages?.includes(lightboxEntry.imageIndex)
          }
          onUsePrompt={handleLightboxUsePrompt}
        />
      ) : null}
      {thoughtsToShow ? (
        <ThoughtsModal thoughts={thoughtsToShow} onClose={() => setThoughtsToShow(null)} />
      ) : null}
    </div>
  );
}
