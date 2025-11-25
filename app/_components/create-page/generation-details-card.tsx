"use client";

import Image from "next/image";
import {
  formatResolution,
  getAspectDescription,
  getQualityLabel,
} from "../../lib/seedream-options";
import { formatDisplayDate } from "./utils";
import type { Generation } from "./types";
import { SpinnerIcon } from "./icons";

// Simple Trash Icon for the delete button
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM5.864 5.363c-.277-.017-.553-.033-.83-.048l.845 10.518a1.25 1.25 0 001.245 1.15h4.808c.675 0 1.23-.534 1.246-1.21l.845-10.52a42.507 42.507 0 00-3.84.21c-.78-.13-1.576-.246-2.388-.348a44.77 44.77 0 00-1.931-.003z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
  return `${simplifiedWidth}:${simplifiedHeight}`;
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
  // Shorten aspect label for compactness
  const aspectLabel = generation
    ? generation.aspect === "custom"
      ? deriveAspectLabel(generation.size)
      : getAspectDescription(generation.aspect).split(" ")[0] // Take just the first word like "Square" or ratio if simplified
    : null;

  // Just show the ratio e.g. "16:9" if possible, or the label if preferred. 
  // User said "name the aspect ratios please", so maybe keep the name but simpler.
  // Let's use the ratio string if available in description, otherwise the label.
  // Actually, let's stick to a clean format.

  return (
    <section className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 flex flex-col gap-4 transition-colors hover:border-[var(--border-highlight)]">
      
      {/* Header: Status or Date */}
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {isGenerating ? (
          <span className="flex items-center gap-1.5 text-[var(--accent-primary)] animate-pulse">
            <SpinnerIcon className="h-3 w-3 animate-spin" />
            Generating...
          </span>
        ) : generation ? (
          <span>{formatDisplayDate(generation.createdAt)}</span>
        ) : (
          <span>Ready</span>
        )}
        
        {generation && !isGenerating && (
           <span className="text-[var(--text-secondary)]">{getQualityLabel(generation.quality)}</span>
        )}
      </div>

      {/* Prompt Body */}
      <div className="space-y-2">
        {errorMessage ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 leading-snug">
            {errorMessage}
          </p>
        ) : null}
        
        {generation ? (
          <p className="text-xs leading-relaxed text-[var(--text-primary)] opacity-90 line-clamp-6 font-normal">
            {generation.prompt}
          </p>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)]">
            Waiting for prompt...
          </p>
        )}
      </div>

      {/* Input Images (Compact) */}
      {generation && generation.inputImages?.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          {generation.inputImages.map((image, index) => (
            <button
              key={image.id ?? `${generation.id}-input-${index}`}
              type="button"
              onClick={() => onPreviewInputImage?.(image)}
              className="relative block h-8 w-8 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] transition-transform hover:scale-110 hover:border-[var(--text-muted)] focus:outline-none"
              title="View reference image"
            >
              <Image
                src={image.url}
                alt={image.name}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-cover opacity-80 hover:opacity-100"
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* Tech Specs & Actions */}
      {generation && (
        <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            {/* Tech Badges */}
            <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                    {formatResolution(generation.size)}
                </span>
                <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                    {aspectLabel ?? "Custom"}
                </span>
            </div>

            {/* Compact Actions */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onUsePrompt(generation.prompt, generation.inputImages)}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title="Reuse Prompt"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        <polyline points="9 9 9 20 20 9" />
                    </svg>
                </button>
                
                {canDelete && onDeleteGeneration && (
                    <button
                        type="button"
                        onClick={() => onDeleteGeneration(generation.id)}
                        className="flex items-center justify-center h-6 w-6 rounded hover:bg-red-950/30 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Delete Batch"
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
      )}
    </section>
  );
}
