import { useEffect, useRef } from "react";
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  FormEvent,
  RefObject,
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

type AttachmentAspectOptionProps = {
  value: string;
  label: string;
  ratio: string;
  resolution: string;
};

type HeaderProps = {
  prompt: string;
  aspectSelection: string;
  attachmentAspectOptions: AttachmentAspectOptionProps[];
  quality: QualityKey;
  seed: string;
  apiKey: string;
  isGenerating: boolean;
  isBudgetLocked: boolean;
  batchCostCents: number;
  isSettingsOpen: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPromptChange: (value: string) => void;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualityKey) => void;
  onSeedChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  useCustomResolution: boolean;
  customWidth: string;
  customHeight: string;
  onToggleCustomResolution: (value: boolean) => void;
  onCustomWidthChange: (value: string) => void;
  onCustomHeightChange: (value: string) => void;
  onToggleSettings: Dispatch<SetStateAction<boolean>>;
  attachments: PromptAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onPreviewAttachment: (attachment: PromptAttachment) => void;
  isAttachmentLimitReached: boolean;
};

export function Header({
  prompt,
  aspectSelection,
  attachmentAspectOptions,
  quality,
  seed,
  apiKey,
  isGenerating,
  isBudgetLocked,
  batchCostCents,
  isSettingsOpen,
  onSubmit,
  onPromptChange,
  onAspectSelect,
  onQualityChange,
  onSeedChange,
  onApiKeyChange,
  useCustomResolution,
  customWidth,
  customHeight,
  onToggleCustomResolution,
  onCustomWidthChange,
  onCustomHeightChange,
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
  const trimmedPrompt = prompt.trim();
  const generateDisabled = trimmedPrompt.length === 0 || isBudgetLocked;
  const batchCostLabel = `${(batchCostCents / 100).toFixed(2)}`;

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
    <header className="sticky top-6 z-40 flex flex-col bg-[#08090f] pb-4">
      <form ref={formRef} onSubmit={onSubmit} className="relative flex flex-col gap-4">
        <div className="relative flex w-full items-center gap-3 rounded-3xl border border-[#1a1b24] bg-[#101117] px-5 py-4 text-sm text-[#9fa1b1] shadow-[0_22px_45px_-35px_rgba(0,0,0,0.8)]">
          <button
            type="button"
            aria-label="Add reference image"
            onClick={handleAttachmentButtonClick}
            disabled={isAttachmentLimitReached}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f202b] bg-[#13141c] text-[#9fa1b1] transition-colors hover:border-[#2b2c37] hover:text-white disabled:cursor-not-allowed disabled:border-[#1f202b] disabled:text-[#4f5161]"
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
            className="flex-1 resize-none overflow-hidden bg-transparent py-1.5 text-base leading-[1.55] text-[#f4f5f9] placeholder:text-[#62636f] focus:outline-none"
            placeholder="Describe the scene you want Seedream 4.0 to imagine..."
          />
          <button
            ref={toggleButtonRef}
            type="button"
            aria-expanded={isSettingsOpen}
            aria-haspopup="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSettings((previous) => !previous);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#24252f] bg-[#14151f] text-[#9fa1b1] transition-colors hover:border-[#2f303a] hover:text-white"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <button
            type="submit"
            aria-label="Generate"
            disabled={generateDisabled}
            title={
              isBudgetLocked
                ? "Budget limit reached. Adjust or reset your budget to generate more images."
                : `Each batch costs ${batchCostLabel}.`
            }
            className="flex items-center gap-2 rounded-full bg-[#e9eaef] px-4 py-2.5 text-sm font-semibold text-[#090a12] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-[#2a2b35] disabled:text-[#7b7d8f] sm:px-5"
          >
            {isGenerating ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <LightningIcon className="h-4 w-4" />}
            <span className="hidden sm:inline">{isBudgetLocked ? "Budget Reached" : "Generate"}</span>
          </button>
          {isSettingsOpen ? (
            <SettingsPanel
              panelRef={panelRef}
              aspectSelection={aspectSelection}
              attachmentAspectOptions={attachmentAspectOptions}
              quality={quality}
              seed={seed}
              apiKey={apiKey}
              useCustomResolution={useCustomResolution}
              customWidth={customWidth}
              customHeight={customHeight}
              onAspectSelect={onAspectSelect}
              onQualityChange={onQualityChange}
              onSeedChange={onSeedChange}
              onApiKeyChange={onApiKeyChange}
              onToggleCustomResolution={onToggleCustomResolution}
              onCustomWidthChange={onCustomWidthChange}
              onCustomHeightChange={onCustomHeightChange}
              onShuffleSeed={() => onSeedChange(String(Math.floor(Math.random() * 1_000_000_000)))}
            />
          ) : null}
        </div>
        {attachments.length > 0 ? (
          <div className="px-1">
            <AttachmentPreviewList attachments={attachments} onRemove={onRemoveAttachment} onPreview={onPreviewAttachment} />
          </div>
        ) : null}
      </form>
    </header>
  );
}

type SettingsPanelProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  aspectSelection: string;
  attachmentAspectOptions: AttachmentAspectOptionProps[];
  quality: QualityKey;
  seed: string;
  apiKey: string;
  useCustomResolution: boolean;
  customWidth: string;
  customHeight: string;
  onAspectSelect: (value: string) => void;
  onQualityChange: (value: QualityKey) => void;
  onSeedChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onToggleCustomResolution: (value: boolean) => void;
  onCustomWidthChange: (value: string) => void;
  onCustomHeightChange: (value: string) => void;
  onShuffleSeed: () => void;
};

function SettingsPanel({
  panelRef,
  aspectSelection,
  attachmentAspectOptions,
  quality,
  seed,
  apiKey,
  useCustomResolution,
  customWidth,
  customHeight,
  onAspectSelect,
  onQualityChange,
  onSeedChange,
  onApiKeyChange,
  onToggleCustomResolution,
  onCustomWidthChange,
  onCustomHeightChange,
  onShuffleSeed,
}: SettingsPanelProps) {
  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-[calc(100%+12px)] z-20 w-[320px] rounded-3xl border border-[#1a1b24] bg-[#0d0e15] p-4 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.85)]"
      role="dialog"
    >
      <div className="space-y-4 text-sm text[#d4d5df]">
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            Aspect ratio
          </span>
          <select
            value={aspectSelection}
            onChange={(event) => onAspectSelect(event.target.value)}
            className="w-full rounded-2xl border border-[#1f202b] bg-[#14151f] px-4 py-2 text-sm text-white focus:border-[#3a3b47] focus:outline-none"
          >
            {ASPECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {`${option.label} (${option.description})`}
              </option>
            ))}
            <option value="custom">Custom (manual)</option>
            {attachmentAspectOptions.length > 0 ? (
              <optgroup label="From uploads">
                {attachmentAspectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {`${option.label} - ${option.ratio} (${option.resolution})`}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            Quality
          </span>
          <select
            value={quality}
            onChange={(event) => onQualityChange(event.target.value as QualityKey)}
            className="w-full rounded-2xl border border bath#[1f202b] bg-[#14151f] px-4 py-2 text-sm text-white focus:border-[#3a3b47] focus:outline-none"
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {`${option.label} (${option.description})`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            Seed
          </span>
          <div className="flex items-center gap-2">
            <input
              value={seed}
              onChange={(event) => onSeedChange(event.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="Random"
              className="flex-1 rounded-2xl border border[#1f202b] bg-[#14151f] px-4 py-2 text-sm text-white placeholder:text-[#5d5f6d] focus:border-[#3a3b47] focus:outline-none"
            />
            <button
              type="button"
              onClick={onShuffleSeed}
              className="rounded-2xl border border-[#1f202b] bg-[#151620] px-3 py-2 text-xs font-semibold text-[#d4d5df] transition-colors hover:border-[#2a2b36]"
            >
              Shuffle
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            Custom resolution
          </span>
          <label className="flex items-center gap-2 text-xs text-[#a7a9ba]">
            <input
              type="checkbox"
              checked={useCustomResolution}
              onChange={(event) => onToggleCustomResolution(event.target.checked)}
              className="h-4 w-4 rounded border border-[#2a2b36] bg-[#14151f]"
            />
            <span>Override automatic size</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={customWidth}
              onChange={(event) => onCustomWidthChange(event.target.value)}
              type="number"
              min={512}
              max={4096}
              placeholder="Width"
              disabled={!useCustomResolution}
              inputMode="numeric"
              className="w-full rounded-2xl border border-[#1f202b] bg-[#14151f] px-4 py-2 text-sm text-white placeholder:text-[#5d5f6d] focus:border-[#3a3b47] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              value={customHeight}
              onChange={(event) => onCustomHeightChange(event.target.value)}
              type="number"
              min={512}
              max={4096}
              placeholder="Height"
              disabled={!useCustomResolution}
              inputMode="numeric"
              className="w-full rounded-2xl border border-[#1f202b] bg-[#14151f] px-4 py-2 text-sm text-white placeholder:text-[#5d5f6d] focus:border-[#3a3b47] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <p className="text-[11px] text-[#6a6c7b]">Enter values between 512 and 4096 px.</p>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            FAL API key
          </span>
          <input
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            type="password"
            placeholder="fal_sk_..."
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-[#1f202b] bg-[#14151f] px-4 py-2 text-sm text-white placeholder:text-[#5d5f6d] focus:border-[#3a3b47] focus:outline-none"
          />
          <p className="text-[11px] text-[#6a6c7b]">Stored locally in this browser only.</p>
        </div>
      </div>
    </div>
  );
}






