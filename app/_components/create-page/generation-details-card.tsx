"use client";

import Image from "next/image";
import {
  formatResolution,
  getAspectDescription,
  getQualityLabel,
} from "../../lib/seedream-options";
import { formatDisplayDate } from "./utils";
import type { Generation } from "./types";
import { CaretRightIcon, SpinnerIcon } from "./icons";

function deriveAspectLabel(size: { width: number; height: number }): string {
  const { width, height } = size;
  if (!width || !height) {
    return "Custom";
  }

  let x = Math.abs(width);
  let y = Math.abs(height);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  const divisor = x || 1;
  const simplifiedWidth = Math.round(width / divisor);
  const simplifiedHeight = Math.round(height / divisor);
  return `Custom (${simplifiedWidth} : ${simplifiedHeight})`;
}


type GenerationDetailsCardProps = {
  generation: Generation | null;
  isGenerating: boolean;
  errorMessage: string | null;
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"]) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration?: (generationId: string) => void;
  canDelete?: boolean;
};

export function GenerationDetailsCard({
  generation,
  isGenerating,
  errorMessage,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
  canDelete = false,
}: GenerationDetailsCardProps) {
  const seedLabel = generation?.seed ?? "random";
  const aspectLabel = generation ? (generation.aspect === "custom" ? deriveAspectLabel(generation.size) : getAspectDescription(generation.aspect)) : null;

  return (
    <section className="w-full rounded-3xl border border-[#171822] bg-[#101117] p-4 shadow-[0_20px_40px_-40px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-center gap-2">
        {generation ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#222330] bg-[#15161f] px-3 py-1 text-xs font-medium text-[#dcdde5]">
            {formatResolution(generation.size)}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#222330] bg-[#15161f] px-3 py-1 text-xs text-[#8b8e9d]">
            Resolution pending
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[#8b8e9d]">
          {isGenerating ? (
            <span className="flex items-center gap-1 text-[#f5a25b]">
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> Rendering
            </span>
          ) : null}
          {generation ? <span>{getQualityLabel(generation.quality)}</span> : null}
        </div>
      </div>
      <div className="mt-4 space-y-3 text-[13px] leading-6 text-[#dcdde5]">
        {errorMessage ? (
          <p className="rounded-xl border border-[#412f2f] bg-[#251212] px-3 py-2 text-[#f2b5b5]">
            {errorMessage}
          </p>
        ) : null}
        {generation ? (
          <p>{generation.prompt}</p>
        ) : (
          <p className="text-[#8b8e9d]">Enter a prompt above and your batches will appear here.</p>
        )}
      </div>
      {generation && generation.inputImages?.length ? (
        <div className="mt-4 space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
            Input images
          </span>
          <div className="flex flex-wrap gap-2">
            {generation.inputImages.map((image, index) => (
              <button
                key={image.id ?? `${generation.id}-input-${index}`}
                type="button"
                onClick={() => onPreviewInputImage?.(image)}
                className="group relative block h-16 w-16 overflow-hidden rounded-2xl border border-[#1f202b] bg-[#14151f] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <Image
                  src={image.url}
                  alt={image.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full select-none object-cover"
                  draggable={false}
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white opacity-0 transition-opacity group-hover:opacity-100">
                  View
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {generation ? (
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-[#a7a9ba]">
          <span className="rounded-full border border-[#222330] bg-[#15161f] px-2.5 py-1">
            {aspectLabel ?? getAspectDescription(generation.aspect)}
          </span>
          <span className="rounded-full border border-[#222330] bg-[#15161f] px-2.5 py-1">
            Seed {seedLabel}
          </span>
          <span className="rounded-full border border-[#222330] bg-[#15161f] px-2.5 py-1">
            {formatDisplayDate(generation.createdAt)}
          </span>
        </div>
      ) : null}
      {generation ? (
        <div className="mt-4 border-t border-[#1a1b24]">
          <button
            type="button"
            className="flex w-full items-center justify-between py-3 text-sm font-medium text-[#dcdde5] transition-colors hover:text-white cursor-pointer"
            onClick={() => onUsePrompt(generation.prompt, generation.inputImages)}
          >
            <span>Use prompt</span>
            <CaretRightIcon className="h-4 w-4 text-[#5d5f6d]" />
          </button>
          {canDelete && onDeleteGeneration ? (
            <button
              type="button"
              className="flex w-full items-center justify-between border-t border-[#1a1b24] py-3 text-sm font-medium text-[#f2b5b5] transition-colors hover:text-[#ff9999] cursor-pointer"
              onClick={() => onDeleteGeneration(generation.id)}
            >
              <span>Delete batch</span>
              <CaretRightIcon className="h-4 w-4 text-[#a26060]" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


