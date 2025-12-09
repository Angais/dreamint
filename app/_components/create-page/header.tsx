import { useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  FormEvent,
  DragEvent,
  SetStateAction,
} from "react";

import {
  ASPECT_OPTIONS,
  QUALITY_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  PROVIDER_OPTIONS,
  type QualityKey,
  type OutputFormat,
  type Provider,
} from "../../lib/seedream-options";
import { LightningIcon, PlusIcon, SettingsIcon } from "./icons";
import { AttachmentPreviewList } from "./attachment-preview";
import type { PromptAttachment } from "./types";
import { resizeTextarea } from "./utils";

type HeaderProps = {
  prompt: string;
  aspect: string;
  quality: QualityKey;
  outputFormat: OutputFormat;
  provider: Provider;
  useGoogleSearch: boolean;
  imageCount: number;
  apiKey: string;
  geminiApiKey: string;
  isBudgetLocked: boolean;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualityKey) => void;
  onOutputFormatChange: (value: OutputFormat) => void;
  onProviderChange: (value: Provider) => void;
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
};

export function Header({
  prompt,
  aspect,
  quality,
  outputFormat,
  provider,
  useGoogleSearch,
  imageCount,
  apiKey,
  geminiApiKey,
  isBudgetLocked,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onAspectSelect,
  onQualityChange,
  onOutputFormatChange,
  onProviderChange,
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
}: HeaderProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const searchToggleDisabled = provider !== "gemini";
  const trimmedPrompt = prompt.trim();
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked;
  const handleGoogleSearchToggle = () => {
    if (searchToggleDisabled) {
      return;
    }
    onToggleGoogleSearch(!useGoogleSearch);
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
    <header className="flex flex-col items-center justify-center gap-6 w-full max-w-3xl mx-auto transition-all duration-500 ease-out">
      <form ref={formRef} onSubmit={onSubmit} className="w-full flex flex-col gap-4">
        
        {/* Main Studio Input */}
        <div
          className={`group relative flex w-full flex-col gap-3 rounded-[24px] border transition-all duration-300 p-1 ${
            isDragOver 
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
                    onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        if (generateDisabled) {
                        event.preventDefault();
                        return;
                        }

                        event.preventDefault();
                        formRef.current?.requestSubmit();
                    }
                    }}
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
                            onChange={(event) => onAspectSelect(event.target.value)}
                            className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-3 pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                        >
                             {ASPECT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                {option.label} ({option.description})
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                             <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                     </div>

                     {/* Aspect Selector (Mobile: Numbers Only) */}
                     <div className="relative group/select shrink-0 md:hidden">
                        <select
                            value={aspect}
                            onChange={(event) => onAspectSelect(event.target.value)}
                            className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                        >
                             {ASPECT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                {option.description.replace(/\s/g, "")}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                             <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                     </div>

                     {/* Quality Selector (Dropdown) */}
                     <div className="relative group/select shrink-0">
                        <select
                            value={quality}
                            onChange={(event) => onQualityChange(event.target.value as QualityKey)}
                            className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                        >
                             {QUALITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                             <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                     </div>

                     {/* Image Count Selector (Dropdown) */}
                     <div className="relative group/select shrink-0">
                        <select
                            value={imageCount}
                            onChange={(event) => onImageCountChange(parseInt(event.target.value, 10))}
                            className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                        >
                             {[1, 2, 3, 4].map((count) => (
                                <option key={count} value={count}>
                                {count} {count === 1 ? "Image" : "Images"}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                             <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                     </div>

                       {/* Settings Toggle */}
                      <button
                        ref={toggleButtonRef}
                        type="button"
                        onClick={() => onToggleSettings((prev) => !prev)}
                        className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                             isSettingsOpen 
                             ? "bg-white text-black border-white" 
                             : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]"
                        }`}
                      >
                         <SettingsIcon className="h-3.5 w-3.5" />
                      </button>
                 </div>

                 <button
                    type="submit"
                    disabled={generateDisabled}
                    className="shrink-0 group relative flex items-center gap-2 rounded-xl bg-white px-4 py-2 md:px-6 text-sm font-bold text-black shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale"
                 >
                     <LightningIcon className="h-4 w-4" />
                     <span className="hidden md:inline">{isBudgetLocked ? "Limit Reached" : "Generate"}</span>
                 </button>
            </div>
            
             {/* Settings Panel */}
             {isSettingsOpen ? (
                <div ref={panelRef} className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200">
                     <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                           <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Provider</span>
                           <div className="flex gap-2">
                              {PROVIDER_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => onProviderChange(opt.value)}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                                    provider === opt.value
                                      ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-black"
                                      : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Google Search Toggle (In Settings) */}
                        <div className="space-y-2">
                           <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Grounding</span>
                             <div
                                className={`flex items-center gap-2 rounded-lg border bg-[var(--bg-input)] px-2.5 py-2 transition-all ${
                                useGoogleSearch ? "border-[var(--text-primary)]" : "border-[var(--border-subtle)]"
                                } ${searchToggleDisabled ? "opacity-50" : ""}`}
                                aria-disabled={searchToggleDisabled}
                            >
                                <button
                                type="button"
                                onClick={handleGoogleSearchToggle}
                                disabled={searchToggleDisabled}
                                aria-pressed={useGoogleSearch}
                                aria-label="Toggle Google Search grounding"
                                title={searchToggleDisabled ? "Available when using Gemini" : "Ground with Google Search"}
                                className={`relative h-5 w-9 rounded-full transition-colors ${
                                    useGoogleSearch ? "bg-[var(--text-primary)]" : "bg-[var(--border-subtle)]"
                                } ${searchToggleDisabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-[var(--text-muted)]/60"}`}
                                >
                                <span
                                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                    useGoogleSearch ? "translate-x-4" : ""
                                    }`}
                                />
                                </button>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                {useGoogleSearch ? "Google Search Enabled" : searchToggleDisabled ? "Google Search (Gemini Only)" : "Google Search Disabled"}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                           <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Output Format</span>
                           <div className="flex gap-2">
                              {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => onOutputFormatChange(opt.value)}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                                    outputFormat === opt.value
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
                          <div className="space-y-2">
                              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">FAL API Key</span>
                              <input
                                  value={apiKey}
                                  onChange={(e) => onApiKeyChange(e.target.value)}
                                  type="password"
                                  placeholder="fal_sk_..."
                                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                              />
                          </div>
                        ) : null}

                        {provider === "gemini" ? (
                          <div className="space-y-2">
                              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Gemini API Key</span>
                              <input
                                  value={geminiApiKey}
                                  onChange={(e) => onGeminiApiKeyChange(e.target.value)}
                                  type="password"
                                  placeholder="AIzaSy... (Gemini API)"
                                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                              />
                              <p className="text-[9px] text-[var(--text-muted)]">
                                Gemini API runs on the Generative Language endpoint.
                              </p>
                          </div>
                        ) : null}

                        <p className="text-[10px] font-bold text-orange-400 mt-1 text-center">
                          ⚠️ API calls may fail or incur charges; you are fully responsible for any usage.
                        </p>
                        
                        <p className="text-[10px] text-[var(--text-muted)] text-center">Keys are stored locally on your device.</p>
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
