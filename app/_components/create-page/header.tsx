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
  OPENAI_QUALITY_OPTIONS,
  getAspectOptionsForModel,
  QUALITY_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  type AspectSelection,
  type GeminiModelVariant,
  type OpenAIQuality,
  type OpenAIResolutionMode,
  type QualitySelection,
  type OutputFormat,
  type Provider,
} from "../../lib/seedream-options";
import type { OpenAIEstimatedCostBreakdown } from "../../lib/openai-image-costs";
import { ArrowLeftIcon, ArrowRightIcon, CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, LightningIcon, PencilIcon, PlusIcon, SettingsIcon, WandIcon, XIcon } from "./icons";
import { AttachmentPreviewList } from "./attachment-preview";
import type { PromptAttachment } from "./types";
import { resizeTextarea } from "./utils";

type HeaderProps = {
  prompt: string;
  promptHistory: string[];
  promptSnippets: string[];
  aspect: AspectSelection;
  quality: QualitySelection;
  outputFormat: OutputFormat;
  provider: Provider;
  geminiModelVariant: GeminiModelVariant;
  openAIQuality: OpenAIQuality;
  openAIApiKey: string;
  openAIApiKeyUpdatedAt: string | null;
  openAIResolutionMode: OpenAIResolutionMode;
  openAICustomWidth: string;
  openAICustomHeight: string;
  openAICustomSizeError: string | null;
  openAIPresetSizeLabel: string;
  estimatedOpenAICost: OpenAIEstimatedCostBreakdown | null;
  imageCount: number;
  appVersion: string;
  totalImages: number;
  isBudgetLocked: boolean;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onSavePromptSnippet: () => void;
  onImprovePrompt: () => Promise<boolean>;
  onUsePromptSnippet: (value: string) => void;
  onDeletePromptSnippet: (value: string) => void;
  onRenamePromptSnippet: (previousValue: string, nextValue: string) => void;
  onMovePromptSnippet: (value: string, direction: -1 | 1) => void;
  onRestorePromptSnippets: (values: string[]) => void;
  onDeletePromptHistoryItem: (value: string) => void;
  onClearPromptHistory: () => void;
  onRestorePromptHistory: (values: string[]) => void;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualitySelection) => void;
  onOutputFormatChange: (value: OutputFormat) => void;
  onOpenAIQualityChange: (value: OpenAIQuality) => void;
  onOpenAIApiKeyChange: (value: string) => void;
  onOpenAIResolutionModeChange: (value: OpenAIResolutionMode) => void;
  onOpenAICustomWidthChange: (value: string) => void;
  onOpenAICustomHeightChange: (value: string) => void;
  onImageCountChange: (value: number) => void;
  onToggleSettings: Dispatch<SetStateAction<boolean>>;
  attachments: PromptAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onClearAttachments: () => void;
  onPreviewAttachment: (attachment: PromptAttachment) => void;
  onMoveAttachment: (attachmentId: string, direction: -1 | 1) => void;
  isAttachmentLimitReached: boolean;
  maxAttachments: number;
  canUseAutoQuality: boolean;
};

export function Header({
  prompt,
  promptHistory,
  promptSnippets,
  aspect,
  quality,
  outputFormat,
  provider,
  geminiModelVariant,
  openAIQuality,
  openAIApiKey,
  openAIApiKeyUpdatedAt,
  openAIResolutionMode,
  openAICustomWidth,
  openAICustomHeight,
  openAICustomSizeError,
  openAIPresetSizeLabel,
  estimatedOpenAICost,
  imageCount,
  appVersion,
  totalImages,
  isBudgetLocked,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onSavePromptSnippet,
  onImprovePrompt,
  onUsePromptSnippet,
  onDeletePromptSnippet,
  onRenamePromptSnippet,
  onMovePromptSnippet,
  onRestorePromptSnippets,
  onDeletePromptHistoryItem,
  onClearPromptHistory,
  onRestorePromptHistory,
  onAspectSelect,
  onQualityChange,
  onOutputFormatChange,
  onOpenAIQualityChange,
  onOpenAIApiKeyChange,
  onOpenAIResolutionModeChange,
  onOpenAICustomWidthChange,
  onOpenAICustomHeightChange,
  onImageCountChange,
  onToggleSettings,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onClearAttachments,
  onPreviewAttachment,
  onMoveAttachment,
  isAttachmentLimitReached,
  maxAttachments,
  canUseAutoQuality,
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
  const deleteSnippetTimeoutRef = useRef<number | null>(null);
  const clearApiKeyTimeoutRef = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [promptCopyState, setPromptCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [setupCopyState, setSetupCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [setupDownloadState, setSetupDownloadState] = useState<"idle" | "saved" | "failed">("idle");
  const [promptImproveState, setPromptImproveState] =
    useState<"idle" | "improving" | "improved" | "failed">("idle");
  const [apiKeyCopyState, setApiKeyCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isOpenAIApiKeyVisible, setIsOpenAIApiKeyVisible] = useState(false);
  const [clearedOpenAIApiKey, setClearedOpenAIApiKey] = useState<string | null>(null);
  const [clearedPrompt, setClearedPrompt] = useState<string | null>(null);
  const [clearedPromptHistory, setClearedPromptHistory] = useState<string[] | null>(null);
  const [deletedPromptHistory, setDeletedPromptHistory] = useState<{
    label: string;
    snapshot: string[];
  } | null>(null);
  const [deletedPromptSnippet, setDeletedPromptSnippet] = useState<{
    label: string;
    snapshot: string[];
  } | null>(null);
  const [editingPromptSnippet, setEditingPromptSnippet] = useState<{
    original: string;
    draft: string;
  } | null>(null);
  const historyDraftRef = useRef("");
  const historyNavigationRef = useRef(false);
  const isOpenAIProvider = provider === "openai";
  const availableAspectOptions = getAspectOptionsForModel(provider, geminiModelVariant);
  const aspectSelectOptions = [
    { value: "auto", label: "Auto", description: "Image" },
    ...availableAspectOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    })),
  ];
  const qualitySelectValue = isOpenAIProvider ? openAIQuality : quality;
  const qualitySelectOptions = isOpenAIProvider
    ? OPENAI_QUALITY_OPTIONS
    : QUALITY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }));
  const openAIResolutionOptions = [
    ...(canUseAutoQuality ? [{ value: "auto", label: "Auto" }] : []),
    ...QUALITY_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  ];
  const trimmedPrompt = prompt.trim();
  const isImprovingPrompt = promptImproveState === "improving";
  const trimmedOpenAIApiKey = openAIApiKey.trim();
  const remainingAttachmentSlots = Math.max(0, maxAttachments - attachments.length);
  const attachmentSlotLabel =
    remainingAttachmentSlots === 0
      ? "Full"
      : `${remainingAttachmentSlots} ref${remainingAttachmentSlots === 1 ? "" : "s"} left`;
  const promptStats = useMemo(() => {
    const words = trimmedPrompt.length === 0 ? 0 : trimmedPrompt.split(/\s+/).length;
    return {
      characters: prompt.length,
      words,
    };
  }, [prompt, trimmedPrompt]);
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked;
  const canSavePromptSnippet =
    trimmedPrompt.length > 0 && !promptSnippets.includes(trimmedPrompt);
  const visiblePromptHistory = promptHistory.filter((historyItem) => historyItem !== trimmedPrompt);
  const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value < 0.01 ? 4 : 2,
      maximumFractionDigits: value < 0.01 ? 4 : 2,
    }).format(value);
  const formatSettingLabel = (value: string) => value.replace(/-/g, " ");
  const formatOpenAIApiKeyUpdatedAt = () => {
    if (!openAIApiKeyUpdatedAt) {
      return null;
    }

    const updatedAtMs = Date.parse(openAIApiKeyUpdatedAt);
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
      aspect === "auto"
        ? `Auto${attachments[0]?.width && attachments[0]?.height ? ` (${attachments[0].width}x${attachments[0].height})` : ""}`
        : aspectSelectOptions.find((option) => option.value === aspect)?.label ?? formatSettingLabel(aspect);
    const customSizeLabel =
      openAICustomWidth.trim() && openAICustomHeight.trim()
        ? `${openAICustomWidth.trim()}x${openAICustomHeight.trim()}`
        : "Exact size";
    const resolutionLabel =
      openAIResolutionMode === "custom"
        ? customSizeLabel
        : openAIResolutionOptions.find((option) => option.value === quality)?.label ??
          formatSettingLabel(quality);
    const qualityLabel =
      qualitySelectOptions.find((option) => option.value === qualitySelectValue)?.label ??
      formatSettingLabel(qualitySelectValue);

    return [
      "# Dreamint Prompt Setup",
      "",
      "## Prompt",
      trimmedPrompt,
      "",
      "## Settings",
      `- Aspect: ${aspectLabel}`,
      `- Resolution: ${resolutionLabel}`,
      `- Resolution mode: ${openAIResolutionMode === "custom" ? "Exact" : "Preset"}`,
      ...(openAIResolutionMode === "preset" ? [`- Preset size: ${openAIPresetSizeLabel}`] : []),
      `- Quality: ${qualityLabel}`,
      `- Output format: ${outputFormat.toUpperCase()}`,
      `- Images: ${imageCount}`,
      `- References: ${attachments.length}`,
      ...(estimatedOpenAICost ? [`- Estimated cost: ${formatUsd(estimatedOpenAICost.totalCostUsd)}`] : []),
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
  const openAIApiKeyStatus = formatOpenAIApiKeyUpdatedAt();
  const handleAttachmentButtonClick = () => {
    if (isAttachmentLimitReached) {
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

  const handleImprovePrompt = async () => {
    if (!trimmedPrompt || isImprovingPrompt) {
      return;
    }

    setPromptImproveState("improving");
    const improved = await onImprovePrompt();
    setPromptImproveState(improved ? "improved" : "failed");
    setHistoryIndex(null);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
      movePromptCaretToEnd();
    });
  };

  const handleCopyOpenAIApiKey = async () => {
    if (!trimmedOpenAIApiKey) {
      return;
    }

    try {
      await copyText(trimmedOpenAIApiKey);
      setApiKeyCopyState("copied");
    } catch (error) {
      console.error("Unable to copy OpenAI API key", error);
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

  const clearDeleteSnippetUndoTimer = () => {
    if (deleteSnippetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(deleteSnippetTimeoutRef.current);
    deleteSnippetTimeoutRef.current = null;
  };

  const dismissDeletedPromptSnippet = () => {
    clearDeleteSnippetUndoTimer();
    setDeletedPromptSnippet(null);
  };

  const clearApiKeyUndoTimer = () => {
    if (clearApiKeyTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clearApiKeyTimeoutRef.current);
    clearApiKeyTimeoutRef.current = null;
  };

  const dismissClearedOpenAIApiKey = () => {
    clearApiKeyUndoTimer();
    setClearedOpenAIApiKey(null);
  };

  const handlePromptChange = (value: string) => {
    if (clearedPrompt !== null) {
      dismissClearedPrompt();
    }

    onPromptChange(value);
  };

  const handleOpenAIApiKeyChange = (value: string) => {
    if (clearedOpenAIApiKey !== null) {
      dismissClearedOpenAIApiKey();
    }

    onOpenAIApiKeyChange(value);
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

  const handleDeletePromptSnippet = (snippet: string) => {
    clearDeleteSnippetUndoTimer();
    if (editingPromptSnippet?.original === snippet) {
      setEditingPromptSnippet(null);
    }
    setDeletedPromptSnippet({ label: snippet, snapshot: promptSnippets });
    onDeletePromptSnippet(snippet);
    deleteSnippetTimeoutRef.current = window.setTimeout(() => {
      setDeletedPromptSnippet(null);
      deleteSnippetTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoDeletePromptSnippet = () => {
    if (deletedPromptSnippet === null) {
      return;
    }

    const snippetsToRestore = deletedPromptSnippet.snapshot;
    dismissDeletedPromptSnippet();
    onRestorePromptSnippets(snippetsToRestore);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const startRenamePromptSnippet = (snippet: string) => {
    dismissDeletedPromptSnippet();
    setEditingPromptSnippet({ original: snippet, draft: snippet });
  };

  const cancelRenamePromptSnippet = () => {
    setEditingPromptSnippet(null);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const appendPromptSnippet = (snippet: string) => {
    const nextPrompt = trimmedPrompt.length > 0 ? `${prompt.trimEnd()}\n\n${snippet}` : snippet;
    onPromptChange(nextPrompt);
    setHistoryIndex(null);
    historyDraftRef.current = nextPrompt;
    movePromptCaretToEnd();
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const saveRenamedPromptSnippet = () => {
    if (editingPromptSnippet === null) {
      return;
    }

    const trimmedDraft = editingPromptSnippet.draft.trim();
    if (!trimmedDraft) {
      return;
    }

    onRenamePromptSnippet(editingPromptSnippet.original, trimmedDraft);
    setEditingPromptSnippet(null);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  };

  const handleClearOpenAIApiKey = () => {
    if (!trimmedOpenAIApiKey) {
      return;
    }

    clearApiKeyUndoTimer();
    setClearedOpenAIApiKey(openAIApiKey);
    setApiKeyCopyState("idle");
    onOpenAIApiKeyChange("");
    clearApiKeyTimeoutRef.current = window.setTimeout(() => {
      setClearedOpenAIApiKey(null);
      clearApiKeyTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoClearOpenAIApiKey = () => {
    if (clearedOpenAIApiKey === null) {
      return;
    }

    const keyToRestore = clearedOpenAIApiKey;
    dismissClearedOpenAIApiKey();
    onOpenAIApiKeyChange(keyToRestore);
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
    if (isAttachmentLimitReached) {
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
    event.dataTransfer.dropEffect = isAttachmentLimitReached ? "none" : "copy";

    if (!isAttachmentLimitReached) {
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

    if (droppedFiles.length === 0 || isAttachmentLimitReached) {
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
    if (promptImproveState === "idle" || promptImproveState === "improving") {
      return;
    }

    const timeoutId = window.setTimeout(() => setPromptImproveState("idle"), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [promptImproveState]);

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
      clearDeleteSnippetUndoTimer();
      clearApiKeyUndoTimer();
    },
    [],
  );

  return (
    <header className="flex flex-col items-center justify-center gap-6 w-full max-w-4xl mx-auto transition-all duration-500 ease-out">
      <form ref={formRef} onSubmit={onSubmit} className="w-full flex flex-col gap-4">

        {/* Main Studio Input */}
        <div
          className={`group relative flex w-full flex-col gap-3 rounded-[24px] border transition-all duration-300 p-1 ${isDragOver
            ? "border-[var(--text-primary)] bg-[var(--bg-subtle)] ring-1 ring-[var(--text-primary)]"
            : isImprovingPrompt
              ? "prompt-improve-active border-white/30 bg-[var(--bg-panel)] shadow-2xl shadow-white/[0.06]"
            : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-highlight)] shadow-2xl shadow-black/50"
            }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isImprovingPrompt ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
            >
              <div className="prompt-improve-sweep" />
              <div className="prompt-improve-lines" />
            </div>
          ) : null}

          {/* Prompt Area */}
          <div className="relative flex w-full items-start gap-3 px-3 py-3 md:px-5 md:py-4">
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(event) => handlePromptChange(event.target.value)}
              onPaste={handlePromptPaste}
              onKeyDown={handlePromptKeyDown}
              rows={1}
              className="flex-1 resize-none overflow-y-auto max-h-40 bg-transparent text-base md:text-lg leading-[1.6] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
              placeholder="What are you imagining?"
            />
            <div className="mt-1 flex shrink-0 flex-col items-center gap-1">
              <button
                type="button"
                aria-label={`${isAttachmentLimitReached ? "Reference image limit reached" : "Add reference image"} (${attachmentSlotLabel})`}
                title={attachmentSlotLabel}
                onClick={handleAttachmentButtonClick}
                disabled={isAttachmentLimitReached}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <span
                className={`whitespace-nowrap text-[8px] font-bold uppercase leading-none tracking-[0.14em] ${
                  isAttachmentLimitReached ? "text-amber-200/80" : "text-[var(--text-muted)]"
                }`}
              >
                {attachmentSlotLabel}
              </span>
            </div>
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
                isAutoAspectActive={aspect === "auto"}
              />
            </div>
          ) : null}

          {trimmedPrompt.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-[0.2em]">
                {promptStats.words.toLocaleString()} {promptStats.words === 1 ? "word" : "words"} · {promptStats.characters.toLocaleString()} chars
                {estimatedOpenAICost
                  ? ` · ${estimatedOpenAICost.promptTextTokens.toLocaleString()} tokens`
                  : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { void handleImprovePrompt(); }}
                  disabled={!trimmedPrompt || isImprovingPrompt}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] transition-colors ${
                    promptImproveState === "improved"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : promptImproveState === "failed"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : isImprovingPrompt
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-label={
                    promptImproveState === "improved"
                      ? "Prompt improved"
                      : promptImproveState === "failed"
                        ? "Prompt improvement failed"
                        : "Improve prompt with GPT-5.5 Medium"
                  }
                  title="Improve prompt with GPT-5.5 Medium"
                >
                  <WandIcon className={`h-3 w-3 ${isImprovingPrompt ? "prompt-wand" : ""}`} />
                  {isImprovingPrompt
                    ? "Improving"
                    : promptImproveState === "improved"
                      ? "Improved"
                      : promptImproveState === "failed"
                        ? "Failed"
                        : "Improve"}
                </button>
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

          {(promptSnippets.length > 0 || trimmedPrompt.length > 0) ? (
            <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 text-xs [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <button
                type="button"
                onClick={onSavePromptSnippet}
                disabled={!canSavePromptSnippet}
                className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white disabled:opacity-35 disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--text-secondary)]"
              >
                Save Prompt
              </button>
              {promptSnippets.map((snippet, index) => (
                <div
                  key={snippet}
                  className={`${editingPromptSnippet?.original === snippet ? "max-w-[24rem]" : "max-w-[16rem]"} group/snippet flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white`}
                  title={snippet}
                >
                  {editingPromptSnippet?.original === snippet ? (
                    <>
                      <input
                        type="text"
                        value={editingPromptSnippet.draft}
                        onChange={(event) =>
                          setEditingPromptSnippet((previous) =>
                            previous === null ? previous : { ...previous, draft: event.target.value },
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            saveRenamedPromptSnippet();
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRenamePromptSnippet();
                          }
                        }}
                        className="min-w-40 flex-1 bg-transparent py-1.5 pl-3 pr-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={saveRenamedPromptSnippet}
                        disabled={editingPromptSnippet.draft.trim().length === 0}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-[var(--text-secondary)]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelRenamePromptSnippet}
                        className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Cancel rename"
                        title="Cancel"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onUsePromptSnippet(snippet);
                          promptTextareaRef.current?.focus();
                        }}
                        className="min-w-0 truncate py-1.5 pl-3 pr-2 text-left"
                      >
                        {snippet}
                      </button>
                      <button
                        type="button"
                        onClick={() => startRenamePromptSnippet(snippet)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Rename saved prompt"
                        title="Rename saved prompt"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => appendPromptSnippet(snippet)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Append saved prompt"
                        title="Append to prompt"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePromptSnippet(snippet, -1)}
                        disabled={index === 0}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
                        aria-label="Move saved prompt earlier"
                        title="Move earlier"
                      >
                        <ArrowLeftIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePromptSnippet(snippet, 1)}
                        disabled={index === promptSnippets.length - 1}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
                        aria-label="Move saved prompt later"
                        title="Move later"
                      >
                        <ArrowRightIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromptSnippet(snippet)}
                        className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Delete saved prompt"
                        title="Delete saved prompt"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {deletedPromptSnippet !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-[var(--text-muted)]">
              <span className="min-w-0 truncate font-semibold uppercase tracking-[0.2em]" title={deletedPromptSnippet.label}>
                Saved prompt removed
              </span>
              <button
                type="button"
                onClick={handleUndoDeletePromptSnippet}
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
          <div className="flex flex-nowrap items-center justify-between gap-3 rounded-b-[20px] bg-[var(--bg-subtle)] px-3 py-2 md:px-4 md:py-3 border-t border-[var(--border-subtle)]">
            <div className="flex flex-1 items-center gap-2 overflow-x-auto pr-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

              {/* Aspect Selector (Desktop: Full Label) */}
              <div className="relative group/select shrink-0 hidden md:block">
                <select
                  value={aspect}
                  onChange={(event) => {
                    onAspectSelect(event.target.value);
                    promptTextareaRef.current?.focus();
                  }}
                  className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-3 pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                >
                  {aspectSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.description})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Aspect Selector (Mobile: Numbers Only) */}
              <div className="relative group/select shrink-0 md:hidden">
                <select
                  value={aspect}
                  onChange={(event) => {
                    onAspectSelect(event.target.value);
                    promptTextareaRef.current?.focus();
                  }}
                  className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                >
                  {aspectSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value === "auto" ? "Auto" : option.description.replace(/\s/g, "")}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {isOpenAIProvider ? (
                <div className="relative group/select shrink-0">
                  <select
                    value={quality}
                    onChange={(event) => {
                      onQualityChange(event.target.value as QualitySelection);
                      promptTextareaRef.current?.focus();
                    }}
                    className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  >
                    {openAIResolutionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              ) : null}

              {/* Quality Selector (Dropdown) */}
              <div className="relative group/select shrink-0">
                <select
                  value={qualitySelectValue}
                  onChange={(event) => {
                    if (isOpenAIProvider) {
                      onOpenAIQualityChange(event.target.value as OpenAIQuality);
                    } else {
                      onQualityChange(event.target.value as QualitySelection);
                    }
                    promptTextareaRef.current?.focus();
                  }}
                  className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                >
                  {qualitySelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Image Count Selector (Dropdown) */}
              <div className="relative group/select shrink-0">
                <select
                  value={imageCount}
                  onChange={(event) => {
                    onImageCountChange(parseInt(event.target.value, 10));
                    promptTextareaRef.current?.focus();
                  }}
                  className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                >
                  {[1, 2, 3, 4].map((count) => (
                    <option key={count} value={count}>
                      {count}x
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
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
              {isOpenAIProvider && estimatedOpenAICost ? (
                <div className="group/price relative">
                  <div className="cursor-default rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 text-right text-[11px] font-semibold text-[var(--text-primary)]">
                    <div>{formatUsd(estimatedOpenAICost.totalCostUsd)}</div>
                    <div className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Est.
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-30 hidden w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 text-left shadow-2xl group-hover/price:block group-focus-within/price:block">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                          Estimated Cost
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                          {formatUsd(estimatedOpenAICost.totalCostUsd)}
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-[var(--text-muted)]">
                        <div>
                          {estimatedOpenAICost.size.width}×{estimatedOpenAICost.size.height}
                        </div>
                        <div>{estimatedOpenAICost.quality}</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-[11px] text-[var(--text-secondary)]">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>Output</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatUsd(estimatedOpenAICost.outputCostUsd)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                          {estimatedOpenAICost.outputTokensPerImage.toLocaleString()} tokens/image
                          {estimatedOpenAICost.imageCount > 1
                            ? ` · ${estimatedOpenAICost.outputTokensTotal.toLocaleString()} total`
                            : ""}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Input
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Text</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatUsd(estimatedOpenAICost.inputTextCostUsd)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {estimatedOpenAICost.promptTextTokens.toLocaleString()} tokens
                          {estimatedOpenAICost.imageRequestCount > 1
                            ? ` across ${estimatedOpenAICost.imageRequestCount} requests`
                            : ""}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span>Images</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatUsd(estimatedOpenAICost.inputImageCostUsd)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {estimatedOpenAICost.inputImageTokens.toLocaleString()} tokens
                          {estimatedOpenAICost.imageRequestCount > 1
                            ? ` across ${estimatedOpenAICost.imageRequestCount} requests`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={generateDisabled}
                className="group relative flex items-center gap-2 rounded-xl bg-white px-4 py-2 md:px-6 text-sm font-bold text-black shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale"
              >
                <LightningIcon className="h-4 w-4" />
                <span className="hidden md:inline">{isBudgetLocked ? "Limit Reached" : "Generate"}</span>
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {isSettingsOpen ? (
            <div ref={panelRef} className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Output Format</span>
                  <div className="flex gap-2">
                    {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onOutputFormatChange(opt.value)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${outputFormat === opt.value
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-black"
                          : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {provider === "openai" ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">OpenAI API Key</span>
                    <div className="relative">
                      <input
                        value={openAIApiKey}
                        onChange={(e) => handleOpenAIApiKeyChange(e.target.value)}
                        type={isOpenAIApiKeyVisible ? "text" : "password"}
                        placeholder="sk-... (OpenAI API)"
                        spellCheck={false}
                        autoComplete="off"
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-3 pr-[7rem] text-sm text-[var(--text-secondary)] transition-all focus:border-white focus:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleClearOpenAIApiKey}
                        disabled={!trimmedOpenAIApiKey}
                        className="absolute right-[4.5rem] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-red-400/10 hover:text-red-200 focus:outline-none focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Clear OpenAI API key"
                        title="Clear key"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyOpenAIApiKey}
                        disabled={!trimmedOpenAIApiKey}
                        className={`absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-30 ${
                          apiKeyCopyState === "copied"
                            ? "bg-emerald-400/10 text-emerald-200"
                            : apiKeyCopyState === "failed"
                              ? "bg-red-400/10 text-red-200"
                              : "text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
                        }`}
                        aria-label={
                          apiKeyCopyState === "copied"
                            ? "OpenAI API key copied"
                            : apiKeyCopyState === "failed"
                              ? "OpenAI API key copy failed"
                              : "Copy OpenAI API key"
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
                        onClick={() => setIsOpenAIApiKeyVisible((isVisible) => !isVisible)}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/25"
                        aria-label={isOpenAIApiKeyVisible ? "Hide OpenAI API key" : "Show OpenAI API key"}
                        title={isOpenAIApiKeyVisible ? "Hide key" : "Show key"}
                      >
                        {isOpenAIApiKeyVisible ? (
                          <EyeOffIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] leading-snug">
                      <span
                        className={`font-semibold uppercase tracking-[0.16em] ${
                          trimmedOpenAIApiKey ? "text-emerald-200/75" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {trimmedOpenAIApiKey
                          ? `Key saved locally${openAIApiKeyStatus ? ` · ${openAIApiKeyStatus}` : ""}`
                          : "No key saved"}
                      </span>
                      <span className="text-orange-400/80">
                        API calls may fail or incur charges; you are fully responsible for any usage.
                      </span>
                    </div>
                    {!trimmedOpenAIApiKey && clearedOpenAIApiKey !== null ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
                        <span className="font-semibold uppercase tracking-[0.18em]">
                          API key cleared
                        </span>
                        <button
                          type="button"
                          onClick={handleUndoClearOpenAIApiKey}
                          className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
                        >
                          Undo
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {provider === "openai" ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Resolution
                    </span>
                    <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenAIResolutionModeChange("preset")}
                        className={`flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          openAIResolutionMode === "preset"
                            ? "bg-[var(--text-primary)] text-black"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                        aria-pressed={openAIResolutionMode === "preset"}
                      >
                        Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAIResolutionModeChange("custom")}
                        className={`flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          openAIResolutionMode === "custom"
                            ? "bg-[var(--text-primary)] text-black"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                        aria-pressed={openAIResolutionMode === "custom"}
                      >
                        Exact
                      </button>
                    </div>

                    {openAIResolutionMode === "custom" ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={openAICustomWidth}
                            onChange={(event) => onOpenAICustomWidthChange(event.target.value)}
                            inputMode="numeric"
                            placeholder="Width"
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                          />
                          <input
                            value={openAICustomHeight}
                            onChange={(event) => onOpenAICustomHeightChange(event.target.value)}
                            inputMode="numeric"
                            placeholder="Height"
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                          />
                        </div>
                        <p className={`text-[10px] leading-snug text-center ${openAICustomSizeError ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                          {openAICustomSizeError ?? "Use multiples of 16, keep the long edge below 3840px, and stay between 655,360 and 8,294,400 pixels."}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] leading-snug text-center text-[var(--text-muted)]">
                        Preset size follows the aspect selector plus the 1K / 2K / 4K control. Current preset: {openAIPresetSizeLabel}.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Version <span className="text-[var(--text-primary)]">{appVersion}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Images <span className="text-[var(--text-primary)]">{totalImages}</span>
                  </span>
                </div>

                <p className="md:col-span-2 text-[10px] text-[var(--text-muted)] text-center">Keys are stored locally on your device.</p>
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
