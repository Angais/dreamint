"use client";

import Image from "next/image";

import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { type PromptAttachment } from "./types";

type AttachmentPreviewListProps = {
  attachments: PromptAttachment[];
  onRemove: (attachmentId: string) => void;
  onPreview: (attachment: PromptAttachment) => void;
  onMove: (attachmentId: string, direction: -1 | 1) => void;
  onClear: () => void;
  isAutoAspectActive: boolean;
};

function formatAttachmentDimensions(attachment: PromptAttachment): string | null {
  if (!attachment.width || !attachment.height) {
    return null;
  }

  return `${Math.round(attachment.width)}x${Math.round(attachment.height)}`;
}

function formatAttachmentType(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }

  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim();
  return subtype ? subtype.replace("jpeg", "jpg").toUpperCase() : null;
}

function formatAttachmentFileSize(fileSize: number | null | undefined): string | null {
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return null;
  }

  if (fileSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(fileSize < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function AttachmentPreviewList({
  attachments,
  onRemove,
  onPreview,
  onMove,
  onClear,
  isAutoAspectActive,
}: AttachmentPreviewListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-0 flex flex-wrap items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, index) => {
          const dimensionsLabel = formatAttachmentDimensions(attachment);
          const typeLabel = formatAttachmentType(attachment.mimeType);
          const fileSizeLabel = formatAttachmentFileSize(attachment.fileSize);
          const metadataLabel = [typeLabel, fileSizeLabel].filter(Boolean).join(" · ");
          const titleParts = [attachment.name, dimensionsLabel, metadataLabel].filter(Boolean);

          return (
            <div
              key={attachment.id}
              className="flex w-20 flex-col items-center gap-1"
            >
              <div
                className="group relative h-16 w-16 overflow-hidden rounded-2xl border border-[#1a1b24] bg-[#0d0e15] shadow-[0_10px_25px_-20px_rgba(0,0,0,0.9)]"
                title={titleParts.join(" - ")}
              >
                <button
                  type="button"
                  className="block h-full w-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/40"
                  onClick={() => onPreview(attachment)}
                >
                  <Image
                    src={attachment.url}
                    alt={attachment.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full select-none object-cover transition-transform group-hover:scale-[1.05]"
                    draggable={false}
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => onRemove(attachment.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] font-semibold text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/40"
                >&times;
                </button>
                {attachments.length > 1 ? (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Move ${attachment.name} earlier`}
                      title="Move earlier"
                      onClick={() => onMove(attachment.id, -1)}
                      disabled={index === 0}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-25 disabled:hover:bg-black/70"
                    >
                      <ArrowLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${attachment.name} later`}
                      title="Move later"
                      onClick={() => onMove(attachment.id, 1)}
                      disabled={index === attachments.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-25 disabled:hover:bg-black/70"
                    >
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              {dimensionsLabel || metadataLabel ? (
                <div className="flex max-w-full flex-col items-center gap-0.5 text-center">
                  {isAutoAspectActive && index === 0 ? (
                    <span className="text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--text-muted)]">
                      Auto
                    </span>
                  ) : null}
                  {dimensionsLabel ? (
                    <span className="max-w-full truncate text-[9px] font-semibold leading-none text-[var(--text-muted)]">
                      {dimensionsLabel}
                    </span>
                  ) : null}
                  {metadataLabel ? (
                    <span className="max-w-full truncate text-[8px] font-semibold uppercase leading-none tracking-[0.08em] text-[var(--text-muted)] opacity-70">
                      {metadataLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {attachments.length > 1 ? (
        <div className="flex h-16 flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {attachments.length} refs
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
