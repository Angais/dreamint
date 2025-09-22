"use client";

import Image from "next/image";

import { type PromptAttachment } from "./types";

type AttachmentPreviewListProps = {
  attachments: PromptAttachment[];
  onRemove: (attachmentId: string) => void;
  onPreview: (attachment: PromptAttachment) => void;
};

export function AttachmentPreviewList({ attachments, onRemove, onPreview }: AttachmentPreviewListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative h-16 w-16 overflow-hidden rounded-2xl border border-[#1a1b24] bg-[#0d0e15] shadow-[0_10px_25px_-20px_rgba(0,0,0,0.9)]"
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
        </div>
      ))}
    </div>
  );
}
