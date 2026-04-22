import { useEffect, useRef, useState } from "react";
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
  OPENAI_MODEL_OPTIONS,
  OPENAI_QUALITY_OPTIONS,
  getAspectOptionsForModel,
  QUALITY_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  PROVIDER_OPTIONS,
  type AspectSelection,
  type FlashReasoningLevel,
  type GeminiModelVariant,
  type OpenAIModelSelection,
  type OpenAIQuality,
  type OpenAIResolutionMode,
  type QualitySelection,
  type OutputFormat,
  type Provider,
} from "../../lib/seedream-options";
import type { OpenAIEstimatedCostBreakdown } from "../../lib/openai-image-costs";
import { LightningIcon, MagnifyingGlassIcon, PlusIcon, SettingsIcon } from "./icons";
import { AttachmentPreviewList } from "./attachment-preview";
import type { PromptAttachment } from "./types";
import { resizeTextarea } from "./utils";

type HeaderProps = {
  prompt: string;
  promptHistory: string[];
  aspect: AspectSelection;
  quality: QualitySelection;
  outputFormat: OutputFormat;
  provider: Provider;
  geminiModelVariant: GeminiModelVariant;
  openAIModel: OpenAIModelSelection;
  openAIQuality: OpenAIQuality;
  openAIApiKey: string;
  openAIResolutionMode: OpenAIResolutionMode;
  openAICustomWidth: string;
  openAICustomHeight: string;
  openAICustomSizeError: string | null;
  openAIPresetSizeLabel: string;
  estimatedOpenAICost: OpenAIEstimatedCostBreakdown | null;
  flashReasoningLevel: FlashReasoningLevel;
  useGoogleSearch: boolean;
  imageCount: number;
  apiKey: string;
  geminiApiKey: string;
  appVersion: string;
  totalImages: number;
  isBudgetLocked: boolean;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualitySelection) => void;
  onOutputFormatChange: (value: OutputFormat) => void;
  onProviderChange: (value: Provider) => void;
  onGeminiModelVariantChange: (value: GeminiModelVariant) => void;
  onOpenAIModelChange: (value: OpenAIModelSelection) => void;
  onOpenAIQualityChange: (value: OpenAIQuality) => void;
  onOpenAIApiKeyChange: (value: string) => void;
  onOpenAIResolutionModeChange: (value: OpenAIResolutionMode) => void;
  onOpenAICustomWidthChange: (value: string) => void;
  onOpenAICustomHeightChange: (value: string) => void;
  onFlashReasoningLevelChange: (value: FlashReasoningLevel) => void;
  onToggleGoogleSearch: (value: boolean) => void;
  onImageCountChange: (value: number) => void;
  onApiKeyChange: (value: string) => void;
  onGeminiApiKeyChange: (value: string) => void;
  onToggleSettings: Dispatch<SetStateAction<boolean>>;
  attachments: PromptAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onPreviewAttachment: (attachment: PromptAttachment) => void;
  isAttachmentLimitReached: boolean;
  canUseAutoQuality: boolean;
};

export function Header({
  prompt,
  promptHistory,
  aspect,
  quality,
  outputFormat,
  provider,
  geminiModelVariant,
  openAIModel,
  openAIQuality,
  openAIApiKey,
  openAIResolutionMode,
  openAICustomWidth,
  openAICustomHeight,
  openAICustomSizeError,
  openAIPresetSizeLabel,
  estimatedOpenAICost,
  flashReasoningLevel,
  useGoogleSearch,
  imageCount,
  apiKey,
  geminiApiKey,
  appVersion,
  totalImages,
  isBudgetLocked,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onAspectSelect,
  onQualityChange,
  onOutputFormatChange,
  onProviderChange,
  onGeminiModelVariantChange,
  onOpenAIModelChange,
  onOpenAIQualityChange,
  onOpenAIApiKeyChange,
  onOpenAIResolutionModeChange,
  onOpenAICustomWidthChange,
  onOpenAICustomHeightChange,
  onFlashReasoningLevelChange,
  onToggleGoogleSearch,
  onImageCountChange,
  onApiKeyChange,
  onGeminiApiKeyChange,
  onToggleSettings,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onPreviewAttachment,
  isAttachmentLimitReached,
  canUseAutoQuality,
}: HeaderProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const historyDraftRef = useRef("");
  const historyNavigationRef = useRef(false);
  const isOpenAIProvider = provider === "openai";
  const searchToggleDisabled = provider !== "gemini";
  const isFlashModel = geminiModelVariant === "flash";
  const availableAspectOptions = getAspectOptionsForModel(provider, geminiModelVariant);
  const aspectSelectOptions = [
    { value: "auto", label: "Auto", description: "Image" },
    ...availableAspectOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    })),
  ];
  const providerModelValue = isOpenAIProvider ? openAIModel : geminiModelVariant;
  const providerModelOptions = isOpenAIProvider
    ? OPENAI_MODEL_OPTIONS
    : [
        { value: "pro", label: "3 Pro" },
        { value: "flash", label: "3.1 Flash" },
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
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked;
  const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value < 0.01 ? 4 : 2,
      maximumFractionDigits: value < 0.01 ? 4 : 2,
    }).format(value);
  const shouldSubmitOnEnter = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }

    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const hasNoHover = window.matchMedia("(hover: none)").matches;
    return !(hasCoarsePointer && hasNoHover);
  };
  const handleGoogleSearchToggle = () => {
    if (searchToggleDisabled) {
      return;
    }
    onToggleGoogleSearch(!useGoogleSearch);
  };
  const handleModelChange = (value: string) => {
    if (isOpenAIProvider) {
      onOpenAIModelChange(value as OpenAIModelSelection);
      return;
    }

    onGeminiModelVariantChange(value as GeminiModelVariant);
  };

  const handleAttachmentButtonClick = () => {
    if (isAttachmentLimitReached) {
      return;
    }

    fileInputRef.current?.click();
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
    if (historyNavigationRef.current) {
      historyNavigationRef.current = false;
      return;
    }
    setHistoryIndex(null);
    historyDraftRef.current = prompt;
  }, [prompt]);

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
          <div className="relative flex w-full items-start gap-3 px-3 py-3 md:px-5 md:py-4">
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onPaste={handlePromptPaste}
              onKeyDown={handlePromptKeyDown}
              rows={1}
              className="flex-1 resize-none overflow-y-auto max-h-40 bg-transparent text-base md:text-lg leading-[1.6] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
              placeholder="What are you imagining?"
            />
            <button
              type="button"
              aria-label="Add reference image"
              onClick={handleAttachmentButtonClick}
              disabled={isAttachmentLimitReached}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <PlusIcon className="h-4 w-4" />
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
              <AttachmentPreviewList attachments={attachments} onRemove={onRemoveAttachment} onPreview={onPreviewAttachment} />
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

              {/* Model Selector */}
              <div className="relative group/select shrink-0 max-w-[180px]">
                <select
                  value={providerModelValue}
                  onChange={(event) => {
                    handleModelChange(event.target.value);
                    promptTextareaRef.current?.focus();
                  }}
                  className="w-full appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                >
                  {providerModelOptions.map((option) => (
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

              {/* Google Search Toggle Button */}
              {provider === "gemini" ? (
                <button
                  type="button"
                  onClick={handleGoogleSearchToggle}
                  disabled={searchToggleDisabled}
                  title={searchToggleDisabled ? "Google Search using Gemini" : "Toggle Google Search"}
                  className={`shrink-0 flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${useGoogleSearch
                    ? "bg-[var(--text-primary)] text-black border-[var(--text-primary)]"
                    : "bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white hover:border-[var(--text-muted)]"
                    } ${searchToggleDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </button>
              ) : null}

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
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span>Images</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatUsd(estimatedOpenAICost.inputImageCostUsd)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {estimatedOpenAICost.inputImageTokens.toLocaleString()} tokens
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
                {PROVIDER_OPTIONS.length > 1 ? (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Provider</span>
                    <div className="flex gap-2">
                      {PROVIDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onProviderChange(opt.value)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${provider === opt.value
                            ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-black"
                            : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

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

                {provider === "fal" ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">FAL API Key</span>
                    <input
                      value={apiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      type="password"
                      placeholder="fal_sk_..."
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                    />
                    <p className="text-[9px] leading-snug text-orange-400/80 text-center">
                      ⚠️ API calls may fail or incur charges; you are fully responsible for any usage.
                    </p>
                  </div>
                ) : null}

                {provider === "gemini" ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Gemini API Key</span>
                    <input
                      value={geminiApiKey}
                      onChange={(e) => onGeminiApiKeyChange(e.target.value)}
                      type="password"
                      placeholder="AIzaSy... (Gemini API)"
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                    />
                    <p className="text-[9px] leading-snug text-orange-400/80 text-center">
                      ⚠️ API calls may fail or incur charges; you are fully responsible for any usage.
                    </p>
                  </div>
                ) : null}

                {provider === "openai" ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">OpenAI API Key</span>
                    <input
                      value={openAIApiKey}
                      onChange={(e) => onOpenAIApiKeyChange(e.target.value)}
                      type="password"
                      placeholder="sk-... (OpenAI API)"
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                    />
                    <p className="text-[9px] leading-snug text-orange-400/80 text-center">
                      API calls may fail or incur charges; you are fully responsible for any usage.
                    </p>
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

                {provider === "gemini" && isFlashModel ? (
                  <div className="space-y-2 md:col-span-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Flash Reasoning
                    </span>
                    <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-0.5">
                      <button
                        type="button"
                        onClick={() => onFlashReasoningLevelChange("minimal")}
                        className={`flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          flashReasoningLevel === "minimal"
                            ? "bg-[var(--text-primary)] text-black"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                        aria-pressed={flashReasoningLevel === "minimal"}
                      >
                        Minimal
                      </button>
                      <button
                        type="button"
                        onClick={() => onFlashReasoningLevelChange("high")}
                        className={`flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          flashReasoningLevel === "high"
                            ? "bg-[var(--text-primary)] text-black"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                        aria-pressed={flashReasoningLevel === "high"}
                      >
                        High
                      </button>
                    </div>
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
