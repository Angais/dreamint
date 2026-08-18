import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  FormEvent,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction,
} from "react";

import {
  AUTO_OPTION,
  OUTPUT_FORMAT_OPTIONS,
  getAspectRatioLabel,
  getQualityLabel,
} from "../../lib/image-options";
import type {
  ImageModel,
  ImageModelEndpoint,
  OutputFormat,
  ProviderPreference,
} from "../../lib/openrouter";
import { CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, LightningIcon, PlusIcon, SettingsIcon, XIcon } from "./icons";
import { AttachmentPreviewList } from "./attachment-preview";
import type { PromptAttachment } from "./types";
import { resizeTextarea } from "./utils";

export type ModelEndpointsState = Record<
  string,
  { status: "loading" | "loaded" | "error"; endpoints: ImageModelEndpoint[] }
>;

type HeaderProps = {
  prompt: string;
  promptHistory: string[];
  aspectRatio: string;
  aspectRatioOptions: string[];
  resolution: string;
  resolutionOptions: string[];
  quality: string;
  qualityOptions: string[];
  outputFormat: OutputFormat;
  imageCount: number;
  maxImageCount: number;
  apiKey: string;
  apiKeyUpdatedAt: string | null;
  modelCatalog: ImageModel[] | null;
  catalogError: string | null;
  enabledModelIds: string[];
  selectedModelId: string | null;
  providerPrefs: Record<string, ProviderPreference>;
  modelEndpoints: ModelEndpointsState;
  referenceLimit: number | null;
  appVersion: string;
  totalImages: number;
  isBudgetLocked: boolean;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onDeletePromptHistoryItem: (value: string) => void;
  onClearPromptHistory: () => void;
  onRestorePromptHistory: (values: string[]) => void;
  onAspectRatioChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onQualityChange: (value: string) => void;
  onOutputFormatChange: (value: OutputFormat) => void;
  onImageCountChange: (value: number) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onToggleModelEnabled: (modelId: string) => void;
  onProviderPrefChange: (modelId: string, pref: ProviderPreference | null) => void;
  onRequestEndpoints: (modelId: string) => void;
  onToggleSettings: Dispatch<SetStateAction<boolean>>;
  attachments: PromptAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onClearAttachments: () => void;
  onPreviewAttachment: (attachment: PromptAttachment) => void;
  onMoveAttachment: (attachmentId: string, direction: -1 | 1) => void;
  isAttachmentLimitReached: boolean;
  maxAttachments: number;
};

export function Header({
  prompt,
  promptHistory,
  aspectRatio,
  aspectRatioOptions,
  resolution,
  resolutionOptions,
  quality,
  qualityOptions,
  outputFormat,
  imageCount,
  maxImageCount,
  apiKey,
  apiKeyUpdatedAt,
  modelCatalog,
  catalogError,
  enabledModelIds,
  selectedModelId,
  providerPrefs,
  modelEndpoints,
  referenceLimit,
  appVersion,
  totalImages,
  isBudgetLocked,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onDeletePromptHistoryItem,
  onClearPromptHistory,
  onRestorePromptHistory,
  onAspectRatioChange,
  onResolutionChange,
  onQualityChange,
  onOutputFormatChange,
  onImageCountChange,
  onApiKeyChange,
  onModelChange,
  onToggleModelEnabled,
  onProviderPrefChange,
  onRequestEndpoints,
  onToggleSettings,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onClearAttachments,
  onPreviewAttachment,
  onMoveAttachment,
  isAttachmentLimitReached,
  maxAttachments,
}: HeaderProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dragCounterRef = useRef(0);
  const clearPromptTimeoutRef = useRef<number | null>(null);
  const clearHistoryTimeoutRef = useRef<number | null>(null);
  const deleteHistoryItemTimeoutRef = useRef<number | null>(null);
  const clearApiKeyTimeoutRef = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [promptCopyState, setPromptCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [setupCopyState, setSetupCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [setupDownloadState, setSetupDownloadState] = useState<"idle" | "saved" | "failed">("idle");
  const [apiKeyCopyState, setApiKeyCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [clearedApiKey, setClearedApiKey] = useState<string | null>(null);
  const [clearedPrompt, setClearedPrompt] = useState<string | null>(null);
  const [clearedPromptHistory, setClearedPromptHistory] = useState<string[] | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [deletedPromptHistory, setDeletedPromptHistory] = useState<{
    label: string;
    snapshot: string[];
  } | null>(null);
  const historyDraftRef = useRef("");
  const historyNavigationRef = useRef(false);

  const enabledModels = useMemo(() => {
    if (!modelCatalog) {
      return enabledModelIds.map((id) => ({ id, label: id }));
    }

    return enabledModelIds.map((id) => {
      const model = modelCatalog.find((entry) => entry.id === id);
      return { id, label: model?.name ?? id };
    });
  }, [enabledModelIds, modelCatalog]);
  const filteredCatalog = useMemo(() => {
    if (!modelCatalog) {
      return [];
    }

    const query = modelSearch.trim().toLowerCase();
    const matches = query
      ? modelCatalog.filter(
          (model) =>
            model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query),
        )
      : modelCatalog;

    // Enabled models first so their provider controls are easy to reach.
    return [...matches].sort((a, b) => {
      const aEnabled = enabledModelIds.includes(a.id) ? 0 : 1;
      const bEnabled = enabledModelIds.includes(b.id) ? 0 : 1;
      if (aEnabled !== bEnabled) {
        return aEnabled - bEnabled;
      }
      return a.name.localeCompare(b.name);
    });
  }, [enabledModelIds, modelCatalog, modelSearch]);

  const aspectSelectOptions = useMemo(
    () => [
      { value: AUTO_OPTION, label: "Auto", description: "Provider default" },
      ...aspectRatioOptions.map((ratio) => ({
        value: ratio,
        label: getAspectRatioLabel(ratio),
        description: ratio.replace(":", " : "),
      })),
    ],
    [aspectRatioOptions],
  );

  const trimmedPrompt = prompt.trim();
  const trimmedApiKey = apiKey.trim();
  const effectiveMaxAttachments =
    referenceLimit !== null ? Math.min(maxAttachments, Math.max(0, referenceLimit)) : maxAttachments;
  const remainingAttachmentSlots = Math.max(0, effectiveMaxAttachments - attachments.length);
  const attachmentLimitReached = isAttachmentLimitReached || remainingAttachmentSlots === 0;
  const attachmentSlotLabel =
    effectiveMaxAttachments === 0
      ? "No refs"
      : remainingAttachmentSlots === 0
        ? "Full"
        : `${remainingAttachmentSlots} ref${remainingAttachmentSlots === 1 ? "" : "s"} left`;
  const promptStats = useMemo(() => {
    const words = trimmedPrompt.length === 0 ? 0 : trimmedPrompt.split(/\s+/).length;
    return {
      characters: prompt.length,
      words,
    };
  }, [prompt, trimmedPrompt]);
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked || !selectedModelId;
  const visiblePromptHistory = promptHistory.filter((historyItem) => historyItem !== trimmedPrompt);
  const selectedModelLabel =
    enabledModels.find((model) => model.id === selectedModelId)?.label ?? null;
  const formatApiKeyUpdatedAt = () => {
    if (!apiKeyUpdatedAt) {
      return null;
    }

    const updatedAtMs = Date.parse(apiKeyUpdatedAt);
    if (Number.isNaN(updatedAtMs)) {
      return null;
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000));
    if (elapsedSeconds < 60) {
      return "updated just now";
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) {
      return `updated ${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `updated ${elapsedHours}h ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `updated ${elapsedDays}d ago`;
  };
  const buildPromptSetupMarkdown = () => {
    const aspectLabel =
      aspectRatio === AUTO_OPTION
        ? `Auto${attachments[0]?.width && attachments[0]?.height ? ` (${attachments[0].width}x${attachments[0].height})` : ""}`
        : aspectRatio;

    return [
      "# Dreamint Prompt Setup",
      "",
      "## Prompt",
      trimmedPrompt,
      "",
      "## Settings",
      `- Model: ${selectedModelLabel ?? "None selected"}`,
      `- Aspect: ${aspectLabel}`,
      ...(resolutionOptions.length > 0 ? [`- Resolution: ${resolution}`] : []),
      ...(qualityOptions.length > 0 ? [`- Quality: ${getQualityLabel(quality)}`] : []),
      `- Output format: ${outputFormat.toUpperCase()}`,
      `- Images: ${imageCount}`,
      `- References: ${attachments.length}`,
    ].join("\n");
  };
  const shouldSubmitOnEnter = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }

    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const hasNoHover = window.matchMedia("(hover: none)").matches;
    return !(hasCoarsePointer && hasNoHover);
  };
  const apiKeyStatus = formatApiKeyUpdatedAt();
  const handleAttachmentButtonClick = () => {
    if (attachmentLimitReached) {
      return;
    }

    fileInputRef.current?.click();
  };

  const copyText = async (value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === "undefined") {
      throw new Error("Clipboard is unavailable.");
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopyPrompt = async () => {
    if (!trimmedPrompt) {
      return;
    }

    try {
      await copyText(trimmedPrompt);
      setPromptCopyState("copied");
    } catch (error) {
      console.error("Unable to copy prompt", error);
      setPromptCopyState("failed");
    }
  };

  const handleCopyPromptSetup = async () => {
    if (!trimmedPrompt) {
      return;
    }

    try {
      await copyText(buildPromptSetupMarkdown());
      setSetupCopyState("copied");
    } catch (error) {
      console.error("Unable to copy prompt setup", error);
      setSetupCopyState("failed");
    }
  };

  const handleDownloadPromptSetup = () => {
    if (!trimmedPrompt || typeof document === "undefined") {
      return;
    }

    try {
      const slug = trimmedPrompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
      const filename = `dreamint-setup-${slug || "prompt"}.md`;
      const blob = new Blob([buildPromptSetupMarkdown()], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSetupDownloadState("saved");
    } catch (error) {
      console.error("Unable to download prompt setup", error);
      setSetupDownloadState("failed");
    }
  };

  const handleCopyApiKey = async () => {
    if (!trimmedApiKey) {
      return;
    }

    try {
      await copyText(trimmedApiKey);
      setApiKeyCopyState("copied");
    } catch (error) {
      console.error("Unable to copy OpenRouter API key", error);
      setApiKeyCopyState("failed");
    }
  };

  const clearPromptUndoTimer = () => {
    if (clearPromptTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clearPromptTimeoutRef.current);
    clearPromptTimeoutRef.current = null;
  };

  const dismissClearedPrompt = () => {
    clearPromptUndoTimer();
    setClearedPrompt(null);
  };

  const clearHistoryUndoTimer = () => {
    if (clearHistoryTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clearHistoryTimeoutRef.current);
    clearHistoryTimeoutRef.current = null;
  };

  const dismissClearedPromptHistory = () => {
    clearHistoryUndoTimer();
    setClearedPromptHistory(null);
  };

  const clearDeleteHistoryItemUndoTimer = () => {
    if (deleteHistoryItemTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(deleteHistoryItemTimeoutRef.current);
    deleteHistoryItemTimeoutRef.current = null;
  };

  const dismissDeletedPromptHistory = () => {
    clearDeleteHistoryItemUndoTimer();
    setDeletedPromptHistory(null);
  };

  const clearApiKeyUndoTimer = () => {
    if (clearApiKeyTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clearApiKeyTimeoutRef.current);
    clearApiKeyTimeoutRef.current = null;
  };

  const dismissClearedApiKey = () => {
    clearApiKeyUndoTimer();
    setClearedApiKey(null);
  };

  const handlePromptChange = (value: string) => {
    if (clearedPrompt !== null) {
      dismissClearedPrompt();
    }

    onPromptChange(value);
  };

  const handleApiKeyChange = (value: string) => {
    if (clearedApiKey !== null) {
      dismissClearedApiKey();
    }

    onApiKeyChange(value);
  };

  const handleClearPrompt = () => {
    if (!trimmedPrompt) {
      return;
    }

    clearPromptUndoTimer();
    setClearedPrompt(prompt);
    onPromptChange("");
    setHistoryIndex(null);
    historyDraftRef.current = "";
    clearPromptTimeoutRef.current = window.setTimeout(() => {
      setClearedPrompt(null);
      clearPromptTimeoutRef.current = null;
    }, 7000);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const handleUndoClearPrompt = () => {
    if (clearedPrompt === null) {
      return;
    }

    const promptToRestore = clearedPrompt;
    dismissClearedPrompt();
    onPromptChange(promptToRestore);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
      movePromptCaretToEnd();
    });
  };

  const handleClearPromptHistory = () => {
    if (promptHistory.length === 0) {
      return;
    }

    dismissDeletedPromptHistory();
    clearHistoryUndoTimer();
    setClearedPromptHistory(promptHistory);
    onClearPromptHistory();
    clearHistoryTimeoutRef.current = window.setTimeout(() => {
      setClearedPromptHistory(null);
      clearHistoryTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoClearPromptHistory = () => {
    if (clearedPromptHistory === null) {
      return;
    }

    const historyToRestore = clearedPromptHistory;
    dismissClearedPromptHistory();
    onRestorePromptHistory(historyToRestore);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const handleDeletePromptHistoryItem = (historyItem: string) => {
    clearDeleteHistoryItemUndoTimer();
    setDeletedPromptHistory({ label: historyItem, snapshot: promptHistory });
    onDeletePromptHistoryItem(historyItem);
    deleteHistoryItemTimeoutRef.current = window.setTimeout(() => {
      setDeletedPromptHistory(null);
      deleteHistoryItemTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoDeletePromptHistoryItem = () => {
    if (deletedPromptHistory === null) {
      return;
    }

    const historyToRestore = deletedPromptHistory.snapshot;
    dismissDeletedPromptHistory();
    onRestorePromptHistory(historyToRestore);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const handleClearApiKey = () => {
    if (!trimmedApiKey) {
      return;
    }

    clearApiKeyUndoTimer();
    setClearedApiKey(apiKey);
    setApiKeyCopyState("idle");
    onApiKeyChange("");
    clearApiKeyTimeoutRef.current = window.setTimeout(() => {
      setClearedApiKey(null);
      clearApiKeyTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoClearApiKey = () => {
    if (clearedApiKey === null) {
      return;
    }

    const keyToRestore = clearedApiKey;
    dismissClearedApiKey();
    onApiKeyChange(keyToRestore);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    void onAddAttachments(Array.from(fileList));
    event.target.value = "";
  };

  const handlePromptPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (clipboardFiles.length === 0) {
      return;
    }

    event.preventDefault();
    void onAddAttachments(clipboardFiles);
  };

  const movePromptCaretToEnd = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const textarea = promptTextareaRef.current;
      if (!textarea) {
        return;
      }
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
  };

  const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as { isComposing?: boolean };
    if (nativeEvent.isComposing) {
      return;
    }

    const isArrowKey = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (isArrowKey && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      const value = event.currentTarget.value;
      const selectionStart = event.currentTarget.selectionStart ?? 0;
      const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
      const isOnFirstLine = !value.slice(0, selectionStart).includes("\n");
      const isOnLastLine = !value.slice(selectionEnd).includes("\n");

      if (event.key === "ArrowUp" && isOnFirstLine) {
        if (promptHistory.length === 0) {
          return;
        }
        event.preventDefault();
        let nextIndex: number | null = null;
        let nextValue: string | null = null;

        if (historyIndex === null) {
          historyDraftRef.current = prompt;
          nextIndex = 0;
          nextValue = promptHistory[0];
        } else if (historyIndex < promptHistory.length - 1) {
          nextIndex = historyIndex + 1;
          nextValue = promptHistory[nextIndex];
        }

        if (nextValue !== null && nextIndex !== null) {
          historyNavigationRef.current = true;
          setHistoryIndex(nextIndex);
          onPromptChange(nextValue);
          movePromptCaretToEnd();
        }
        return;
      }

      if (event.key === "ArrowDown" && isOnLastLine) {
        if (historyIndex === null) {
          return;
        }
        event.preventDefault();
        if (historyIndex <= 0) {
          historyNavigationRef.current = true;
          setHistoryIndex(null);
          onPromptChange(historyDraftRef.current);
        } else {
          const nextIndex = historyIndex - 1;
          historyNavigationRef.current = true;
          setHistoryIndex(nextIndex);
          onPromptChange(promptHistory[nextIndex]);
        }
        movePromptCaretToEnd();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      if (!shouldSubmitOnEnter()) {
        return;
      }

      if (generateDisabled) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const hasImageItems = (items: DataTransferItemList | null | undefined) =>
    Array.from(items ?? []).some((item) => item.kind === "file" && item.type.startsWith("image/"));

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragOver(false);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageItems(event.dataTransfer?.items)) {
      return;
    }

    event.preventDefault();
    if (attachmentLimitReached) {
      event.dataTransfer.dropEffect = "none";
      return;
    }

    dragCounterRef.current += 1;
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageItems(event.dataTransfer?.items)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = attachmentLimitReached ? "none" : "copy";

    if (!attachmentLimitReached) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageItems(event.dataTransfer?.items)) {
      return;
    }

    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageItems(event.dataTransfer?.items)) {
      return;
    }

    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    resetDragState();

    if (droppedFiles.length === 0 || attachmentLimitReached) {
      return;
    }

    void onAddAttachments(droppedFiles);
  };

  useEffect(() => {
    resizeTextarea(promptTextareaRef.current);
  }, [prompt]);

  useEffect(() => {
    if (promptCopyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => setPromptCopyState("idle"), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [promptCopyState]);

  useEffect(() => {
    if (setupCopyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSetupCopyState("idle"), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [setupCopyState]);

  useEffect(() => {
    if (setupDownloadState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSetupDownloadState("idle"), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [setupDownloadState]);

  useEffect(() => {
    if (apiKeyCopyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => setApiKeyCopyState("idle"), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [apiKeyCopyState]);

  useEffect(() => {
    if (historyNavigationRef.current) {
      historyNavigationRef.current = false;
      return;
    }
    setHistoryIndex(null);
    historyDraftRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    if (promptHistory.length > 0 && clearedPromptHistory !== null) {
      clearHistoryUndoTimer();
      setClearedPromptHistory(null);
    }
  }, [clearedPromptHistory, promptHistory.length]);

  useEffect(() => {
    const handleResize = () => {
      resizeTextarea(promptTextareaRef.current);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      if (toggleButtonRef.current && toggleButtonRef.current.contains(targetNode)) {
        return;
      }

      if (!panelRef.current) {
        return;
      }

      if (!panelRef.current.contains(targetNode)) {
        onToggleSettings(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggleSettings(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isSettingsOpen, onToggleSettings]);

  useEffect(
    () => () => {
      clearPromptUndoTimer();
      clearHistoryUndoTimer();
      clearDeleteHistoryItemUndoTimer();
      clearApiKeyUndoTimer();
    },
    [],
  );

  const selectClassName =
    "appearance-none cursor-pointer rounded-md bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pr-7 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors";

  const selectChevron = (
    <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  return (
    <header className="flex flex-col items-center justify-center gap-6 w-full max-w-4xl mx-auto transition-all duration-500 ease-out">
      <form ref={formRef} onSubmit={onSubmit} className="w-full flex flex-col gap-4">

        {/* Main Studio Input */}
        <div
          className={`group relative flex w-full flex-col gap-3 rounded-[24px] border transition-all duration-300 p-1 ${isDragOver
            ? "border-[var(--text-primary)] bg-[var(--bg-subtle)] ring-1 ring-[var(--text-primary)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-highlight)] shadow-2xl shadow-black/50"
            }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Prompt Area */}
          <div className="relative flex w-full items-start gap-3 px-3 py-2.5 md:px-4 md:py-3">
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(event) => handlePromptChange(event.target.value)}
              onPaste={handlePromptPaste}
              onKeyDown={handlePromptKeyDown}
              rows={1}
              className="flex-1 resize-none overflow-y-auto max-h-32 bg-transparent text-sm md:text-base leading-[1.55] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
              placeholder="What are you imagining?"
            />
            <button
              type="button"
              aria-label={`${attachmentLimitReached ? "Reference image limit reached" : "Add reference image"} (${attachmentSlotLabel})`}
              title={attachmentSlotLabel}
              onClick={handleAttachmentButtonClick}
              disabled={attachmentLimitReached}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 ? (
            <div className="px-4 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <AttachmentPreviewList
                attachments={attachments}
                onRemove={onRemoveAttachment}
                onPreview={onPreviewAttachment}
                onMove={onMoveAttachment}
                onClear={onClearAttachments}
                isAutoAspectActive={aspectRatio === AUTO_OPTION}
              />
            </div>
          ) : null}

          {trimmedPrompt.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-[0.2em]">
                {promptStats.words.toLocaleString()} {promptStats.words === 1 ? "word" : "words"} · {promptStats.characters.toLocaleString()} chars
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] transition-colors ${
                    promptCopyState === "copied"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : promptCopyState === "failed"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
                  }`}
                >
                  <CopyIcon className="h-3 w-3" />
                  {promptCopyState === "copied" ? "Copied" : promptCopyState === "failed" ? "Failed" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPromptSetup}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] transition-colors ${
                    setupCopyState === "copied"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : setupCopyState === "failed"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
                  }`}
                >
                  <CopyIcon className="h-3 w-3" />
                  {setupCopyState === "copied" ? "Copied Setup" : setupCopyState === "failed" ? "Failed" : "Copy Setup"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPromptSetup}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] transition-colors ${
                    setupDownloadState === "saved"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : setupDownloadState === "failed"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
                  }`}
                >
                  <DownloadIcon className="h-3 w-3" />
                  {setupDownloadState === "saved" ? "Saved Setup" : setupDownloadState === "failed" ? "Failed" : "Save Setup"}
                </button>
                <button
                  type="button"
                  onClick={handleClearPrompt}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-red-400/40 hover:text-red-200"
                >
                  <XIcon className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {trimmedPrompt.length === 0 && clearedPrompt !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-[0.2em]">
                Prompt cleared
              </span>
              <button
                type="button"
                onClick={handleUndoClearPrompt}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
              >
                Undo
              </button>
            </div>
          ) : null}

          {visiblePromptHistory.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 text-xs [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                Recent
              </span>
              {visiblePromptHistory.map((historyItem) => (
                <div
                  key={historyItem}
                  className="group/recent flex max-w-[18rem] shrink-0 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
                  title={historyItem}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPromptChange(historyItem);
                      promptTextareaRef.current?.focus();
                    }}
                    className="min-w-0 truncate py-1.5 pl-3 pr-2 text-left font-medium"
                  >
                    {historyItem}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePromptHistoryItem(historyItem)}
                    className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Delete recent prompt"
                    title="Delete recent prompt"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleClearPromptHistory}
                className="shrink-0 rounded-full border border-transparent px-2 py-1.5 font-semibold text-[var(--text-muted)] transition-colors hover:text-white"
              >
                Clear
              </button>
            </div>
          ) : null}

          {deletedPromptHistory !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="min-w-0 truncate font-semibold uppercase tracking-[0.2em]" title={deletedPromptHistory.label}>
                Recent prompt removed
              </span>
              <button
                type="button"
                onClick={handleUndoDeletePromptHistoryItem}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
              >
                Undo
              </button>
            </div>
          ) : null}

          {visiblePromptHistory.length === 0 && clearedPromptHistory !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-[0.2em]">
                Recent prompts cleared
              </span>
              <button
                type="button"
                onClick={handleUndoClearPromptHistory}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
              >
                Undo
              </button>
            </div>
          ) : null}

          {/* Control Bar (Integrated) */}
          <div className="flex flex-nowrap items-center justify-between gap-3 rounded-b-[20px] bg-[var(--bg-subtle)] px-2.5 py-1.5 md:px-3 md:py-2 border-t border-[var(--border-subtle)]">
            <div className="flex flex-1 items-center gap-2 overflow-x-auto pr-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

              {/* Model Selector */}
              <div className="relative group/select shrink-0">
                <select
                  value={selectedModelId ?? ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      onModelChange(event.target.value);
                    }
                    promptTextareaRef.current?.focus();
                  }}
                  className={`${selectClassName} max-w-44 md:max-w-56 truncate normal-case`}
                  aria-label="Model"
                >
                  {enabledModels.length === 0 ? (
                    <option value="">Add models in settings</option>
                  ) : (
                    enabledModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))
                  )}
                </select>
                {selectChevron}
              </div>

              {/* Aspect Selector (Desktop: Full Label) */}
              {aspectRatioOptions.length > 0 ? (
                <>
                  <div className="relative group/select shrink-0 hidden md:block">
                    <select
                      value={aspectRatio}
                      onChange={(event) => {
                        onAspectRatioChange(event.target.value);
                        promptTextareaRef.current?.focus();
                      }}
                      className={selectClassName}
                      aria-label="Aspect ratio"
                    >
                      {aspectSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.description})
                        </option>
                      ))}
                    </select>
                    {selectChevron}
                  </div>

                  {/* Aspect Selector (Mobile: Numbers Only) */}
                  <div className="relative group/select shrink-0 md:hidden">
                    <select
                      value={aspectRatio}
                      onChange={(event) => {
                        onAspectRatioChange(event.target.value);
                        promptTextareaRef.current?.focus();
                      }}
                      className={selectClassName}
                      aria-label="Aspect ratio"
                    >
                      {aspectSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value === AUTO_OPTION ? "Auto" : option.value}
                        </option>
                      ))}
                    </select>
                    {selectChevron}
                  </div>
                </>
              ) : null}

              {/* Resolution Selector */}
              {resolutionOptions.length > 0 ? (
                <div className="relative group/select shrink-0">
                  <select
                    value={resolution}
                    onChange={(event) => {
                      onResolutionChange(event.target.value);
                      promptTextareaRef.current?.focus();
                    }}
                    className={selectClassName}
                    aria-label="Resolution"
                  >
                    {resolutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {selectChevron}
                </div>
              ) : null}

              {/* Quality Selector */}
              {qualityOptions.length > 0 ? (
                <div className="relative group/select shrink-0">
                  <select
                    value={quality}
                    onChange={(event) => {
                      onQualityChange(event.target.value);
                      promptTextareaRef.current?.focus();
                    }}
                    className={selectClassName}
                    aria-label="Quality"
                  >
                    {qualityOptions.map((option) => (
                      <option key={option} value={option}>
                        {getQualityLabel(option)}
                      </option>
                    ))}
                  </select>
                  {selectChevron}
                </div>
              ) : null}

              {/* Image Count Selector */}
              <div className="relative group/select shrink-0">
                <select
                  value={imageCount}
                  onChange={(event) => {
                    onImageCountChange(parseInt(event.target.value, 10));
                    promptTextareaRef.current?.focus();
                  }}
                  className="appearance-none cursor-pointer rounded-md bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pr-7 py-1 text-[11px] font-semibold tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  aria-label="Image count"
                >
                  {Array.from({ length: maxImageCount }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count}x
                    </option>
                  ))}
                </select>
                {selectChevron}
              </div>

              {/* Settings Toggle */}
              <button
                ref={toggleButtonRef}
                type="button"
                onClick={() => onToggleSettings((prev) => !prev)}
                className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${isSettingsOpen
                  ? "bg-white text-black border-white"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]"
                  }`}
              >
                <SettingsIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="submit"
                disabled={generateDisabled}
                className="group relative flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 md:px-5 text-sm font-bold text-black shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale"
              >
                <LightningIcon className="h-4 w-4" />
                <span className="hidden md:inline">
                  {isBudgetLocked ? "Limit Reached" : !selectedModelId ? "Pick a Model" : "Generate"}
                </span>
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {isSettingsOpen ? (
            <div ref={panelRef} className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">OpenRouter API Key</span>
                  <div className="relative">
                    <input
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      type={isApiKeyVisible ? "text" : "password"}
                      placeholder="sk-or-..."
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] py-1.5 pl-3 pr-[6.5rem] text-sm text-[var(--text-secondary)] transition-all focus:border-white focus:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      disabled={!trimmedApiKey}
                      className="absolute right-[4.5rem] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-red-400/10 hover:text-red-200 focus:outline-none focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Clear OpenRouter API key"
                      title="Clear key"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      disabled={!trimmedApiKey}
                      className={`absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-30 ${
                        apiKeyCopyState === "copied"
                          ? "bg-emerald-400/10 text-emerald-200"
                          : apiKeyCopyState === "failed"
                            ? "bg-red-400/10 text-red-200"
                            : "text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
                      }`}
                      aria-label={
                        apiKeyCopyState === "copied"
                          ? "OpenRouter API key copied"
                          : apiKeyCopyState === "failed"
                            ? "OpenRouter API key copy failed"
                            : "Copy OpenRouter API key"
                      }
                      title={
                        apiKeyCopyState === "copied"
                          ? "Copied"
                          : apiKeyCopyState === "failed"
                            ? "Copy failed"
                            : "Copy key"
                      }
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsApiKeyVisible((isVisible) => !isVisible)}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/25"
                      aria-label={isApiKeyVisible ? "Hide OpenRouter API key" : "Show OpenRouter API key"}
                      title={isApiKeyVisible ? "Hide key" : "Show key"}
                    >
                      {isApiKeyVisible ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="text-[9px] leading-snug">
                    <span
                      className={`font-semibold uppercase tracking-[0.16em] ${
                        trimmedApiKey ? "text-emerald-200/75" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {trimmedApiKey
                        ? `Key saved locally${apiKeyStatus ? ` · ${apiKeyStatus}` : ""}`
                        : "No key saved"}
                    </span>
                  </div>
                  {!trimmedApiKey && clearedApiKey !== null ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
                      <span className="font-semibold uppercase tracking-[0.18em]">
                        API key cleared
                      </span>
                      <button
                        type="button"
                        onClick={handleUndoClearApiKey}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
                      >
                        Undo
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Output Format</span>
                  <div className="flex gap-1.5">
                    {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onOutputFormatChange(opt.value)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all ${outputFormat === opt.value
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-black"
                          : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Models
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {enabledModelIds.length} enabled
                    </span>
                  </div>
                  <input
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="Search OpenRouter image models..."
                    spellCheck={false}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-all focus:border-white focus:text-white focus:outline-none"
                  />
                  {catalogError ? (
                    <p className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-[11px] font-medium text-red-300">
                      {catalogError}
                    </p>
                  ) : modelCatalog === null ? (
                    <p className="px-1 py-2 text-[11px] text-[var(--text-muted)]">
                      Loading the OpenRouter model catalog...
                    </p>
                  ) : filteredCatalog.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] text-[var(--text-muted)]">
                      No models match &quot;{modelSearch.trim()}&quot;.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
                      {filteredCatalog.map((model) => (
                        <ModelRow
                          key={model.id}
                          model={model}
                          isEnabled={enabledModelIds.includes(model.id)}
                          providerPref={providerPrefs[model.id] ?? null}
                          endpoints={modelEndpoints[model.id]}
                          onToggleEnabled={() => onToggleModelEnabled(model.id)}
                          onProviderPrefChange={(pref) => onProviderPrefChange(model.id, pref)}
                          onRequestEndpoints={() => onRequestEndpoints(model.id)}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] leading-snug text-[var(--text-muted)]">
                    Pinning a provider with fallbacks off makes requests fail instead of rerouting —
                    useful for BYOK.
                  </p>
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <span>
                    v{appVersion} · {totalImages} images
                  </span>
                  <span>Keys stay on this device</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {isDragOver ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-white px-10 py-8 text-xl font-bold text-white">
              Drop Images Here
            </div>
          </div>
        ) : null}
      </form>
    </header>
  );
}

type ModelRowProps = {
  model: ImageModel;
  isEnabled: boolean;
  providerPref: ProviderPreference | null;
  endpoints: ModelEndpointsState[string] | undefined;
  onToggleEnabled: () => void;
  onProviderPrefChange: (pref: ProviderPreference | null) => void;
  onRequestEndpoints: () => void;
};

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white/40 ${
        checked ? "bg-white" : "bg-white/15 hover:bg-white/25"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full transition-all duration-200 ${
          checked ? "left-3.5 bg-black" : "left-0.5 bg-white/70"
        }`}
      />
    </button>
  );
}

function ModelRow({
  model,
  isEnabled,
  providerPref,
  endpoints,
  onToggleEnabled,
  onProviderPrefChange,
  onRequestEndpoints,
}: ModelRowProps) {
  // Provider options are only needed once a model is enabled.
  useEffect(() => {
    if (isEnabled && !endpoints) {
      onRequestEndpoints();
    }
  }, [endpoints, isEnabled, onRequestEndpoints]);

  const pinnedTag = providerPref?.providerTag ?? "";
  const loadedEndpoints = endpoints?.status === "loaded" ? endpoints.endpoints : [];
  // Keep a stale pin visible even if the endpoint list no longer includes it.
  const pinnedIsMissing =
    pinnedTag.length > 0 &&
    endpoints?.status === "loaded" &&
    !loadedEndpoints.some((endpoint) => endpoint.provider_tag === pinnedTag);

  return (
    <div
      className={`rounded-md px-2 py-1.5 transition-colors ${
        isEnabled ? "bg-[var(--bg-subtle)]" : "hover:bg-[var(--bg-subtle)]/60"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[11px] font-semibold ${
              isEnabled ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
            title={model.id}
          >
            {model.name}
          </span>
        </span>
        {isEnabled && pinnedTag ? (
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Pinned
          </span>
        ) : null}
        <Switch checked={isEnabled} onChange={onToggleEnabled} label={`Enable ${model.name}`} />
      </div>

      {isEnabled ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {endpoints?.status === "loading" || !endpoints ? (
            <span className="text-[10px] text-[var(--text-muted)]">Loading providers...</span>
          ) : endpoints.status === "error" ? (
            <button
              type="button"
              onClick={onRequestEndpoints}
              className="text-[10px] font-semibold text-red-300 underline-offset-2 hover:underline"
            >
              Failed to load providers — retry
            </button>
          ) : (
            <>
              <select
                value={pinnedTag}
                onChange={(event) => {
                  const nextTag = event.target.value;
                  onProviderPrefChange(
                    nextTag
                      ? {
                          providerTag: nextTag,
                          allowFallbacks: providerPref?.allowFallbacks ?? false,
                        }
                      : null,
                  );
                }}
                className="max-w-full cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none"
                aria-label={`Provider for ${model.name}`}
              >
                <option value="">Auto provider</option>
                {loadedEndpoints.map((endpoint) => (
                  <option key={endpoint.provider_tag} value={endpoint.provider_tag}>
                    {endpoint.provider_name}
                  </option>
                ))}
                {pinnedIsMissing ? <option value={pinnedTag}>{pinnedTag}</option> : null}
              </select>
              {pinnedTag ? (
                <button
                  type="button"
                  onClick={() =>
                    onProviderPrefChange({
                      providerTag: pinnedTag,
                      allowFallbacks: !(providerPref?.allowFallbacks ?? false),
                    })
                  }
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors ${
                    providerPref?.allowFallbacks
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                      : "border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  title={
                    providerPref?.allowFallbacks
                      ? "Fallbacks allowed: other providers may serve the request if this one fails"
                      : "No fallbacks: requests fail rather than switching provider"
                  }
                >
                  {providerPref?.allowFallbacks ? "Fallbacks on" : "No fallbacks"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
