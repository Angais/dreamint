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
  type QualityKey,
} from "../../lib/seedream-options";
import { LightningIcon, PlusIcon, SettingsIcon, SpinnerIcon } from "./icons";
import { AttachmentPreviewList } from "./attachment-preview";
import type { PromptAttachment } from "./types";
import { resizeTextarea } from "./utils";

type HeaderProps = {
  prompt: string;
  aspect: string;
  quality: QualityKey;
  imageCount: number;
  apiKey: string;
  isGenerating: boolean;
  isBudgetLocked: boolean;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualityKey) => void;
  onImageCountChange: (value: number) => void;
  onApiKeyChange: (value: string) => void;
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
  imageCount,
  apiKey,
  isGenerating,
  isBudgetLocked,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onAspectSelect,
  onQualityChange,
  onImageCountChange,
  onApiKeyChange,
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
  
  const trimmedPrompt = prompt.trim();
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked;

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
            <div className="relative flex w-full items-start gap-3 px-5 py-4">
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
                    className="flex-1 resize-none overflow-hidden bg-transparent text-lg leading-[1.6] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
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
                <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AttachmentPreviewList attachments={attachments} onRemove={onRemoveAttachment} onPreview={onPreviewAttachment} />
                </div>
            ) : null}

            {/* Control Bar (Integrated) */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[20px] bg-[var(--bg-subtle)] px-4 py-3 border-t border-[var(--border-subtle)]">
                 <div className="flex flex-wrap items-center gap-2">
                    {/* Aspect Selector */}
                     <div className="relative group/select">
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

                     {/* Quality Selector (Integrated) */}
                     <div className="relative group/select">
                        <select
                            value={quality}
                            onChange={(event) => onQualityChange(event.target.value as QualityKey)}
                            className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-3 pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                        >
                             {QUALITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                             <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                     </div>

                     {/* Image Count Selector */}
                      <div className="flex items-center rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] p-0.5">
                         {[1, 2, 3, 4].map((count) => (
                             <button
                                key={count}
                                type="button"
                                onClick={() => onImageCountChange(count)}
                                className={`h-6 w-8 rounded-md text-[10px] font-bold transition-all ${
                                    imageCount === count 
                                    ? "bg-[var(--text-primary)] text-black shadow-sm" 
                                    : "text-[var(--text-secondary)] hover:text-white"
                                }`}
                             >
                                {count}
                             </button>
                         ))}
                      </div>

                       {/* Settings Toggle (API Key only now) */}
                      <button
                        ref={toggleButtonRef}
                        type="button"
                        onClick={() => onToggleSettings((prev) => !prev)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
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
                    className="group relative flex items-center gap-2 rounded-xl bg-white px-6 py-2 text-sm font-bold text-black shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:grayscale"
                 >
                     {isGenerating ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <LightningIcon className="h-4 w-4" />}
                     <span>{isBudgetLocked ? "Limit Reached" : "Generate"}</span>
                 </button>
            </div>
            
             {/* Minimal Settings Panel (Just API Key) */}
             {isSettingsOpen ? (
                <div ref={panelRef} className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200">
                     <div className="flex flex-col gap-2">
                        <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">FAL API Key</span>
                            <input
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            type="password"
                            placeholder="fal_sk_..."
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-white focus:text-white focus:outline-none transition-all"
                        />
                        <p className="text-[10px] text-[var(--text-muted)]">Stored locally on your device.</p>
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
