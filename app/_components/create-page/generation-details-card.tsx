"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  getAspectDescription,
  getQualityLabel,
} from "../../lib/seedream-options";
import { formatDisplayDate } from "./utils";
import type { Generation } from "./types";
import { ReuseIcon, SpinnerIcon } from "./icons";

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

// Custom Icon for Retry
function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
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
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"]) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration?: (generationId: string) => void;
  canDelete?: boolean;
  onRetry?: () => void;
};

export function GenerationDetailsCard({
  generation,
  isGenerating,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
  canDelete = false,
  onRetry,
}: GenerationDetailsCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const validInputImages = useMemo(
    () =>
      generation?.inputImages?.filter(
        (img) => typeof img?.url === "string" && img.url.trim().length > 0,
      ) ?? [],
    [generation?.inputImages],
  );
  
  // Get simple aspect ratio e.g. "16:9" from description like "16 : 9"
  const aspectLabel = generation
    ? generation.aspect === "custom"
      ? deriveAspectLabel(generation.size)
      : getAspectDescription(generation.aspect).replace(/\s/g, "")
    : null;

  const deletedSet = new Set(generation?.deletedImages ?? []);
  const isInterrupted =
    !isGenerating &&
    generation?.images.some((img, index) => !img && !deletedSet.has(index));
  const createdAtDate = useMemo(
    () => (generation?.createdAt ? new Date(generation.createdAt) : null),
    [generation?.createdAt],
  );

  useEffect(() => {
    if (!isGenerating || !createdAtDate) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - createdAtDate.getTime());
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isGenerating, createdAtDate]);

  const formattedElapsed = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [elapsedSeconds]);

  return (
    <section className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 flex flex-col gap-4 transition-colors hover:border-[var(--border-highlight)]">
      
      {/* Header: Status or Date */}
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {isGenerating ? (
          <span className="flex items-center gap-2 text-[var(--accent-primary)] animate-pulse">
            <SpinnerIcon className="h-3 w-3 animate-spin" />
            <span className="flex items-center gap-1">
              <span>Generating...</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                {formattedElapsed}
              </span>
            </span>
          </span>
        ) : generation ? (
          <span>{formatDisplayDate(generation.createdAt)}</span>
        ) : (
          <span>Ready</span>
        )}
        
        {generation && !isGenerating && !isInterrupted && (
           <span className="text-[var(--text-secondary)]">{getQualityLabel(generation.quality)}</span>
        )}
      </div>

      {/* Prompt Body or Error */}
      <div className="space-y-2">
        {isInterrupted ? (
           <div className="rounded-lg border border-orange-900/50 bg-orange-950/20 px-3 py-2.5">
             <p className="text-xs text-orange-400 font-medium leading-snug mb-2">
               Request interrupted
             </p>
             <p className="text-[11px] text-orange-300/70 leading-relaxed">
               The page was reloaded or closed before the image finished.
             </p>
             {onRetry && (
               <button 
                 onClick={onRetry}
                 className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-400 hover:text-orange-300 transition-colors"
               >
                 <RetryIcon className="h-3 w-3" />
                 Retry Request
               </button>
             )}
           </div>
        ) : null}
        
        {generation && !isInterrupted ? (
          <p className="text-xs leading-relaxed text-[var(--text-primary)] opacity-90 font-normal max-h-32 overflow-y-auto">
            {generation.prompt}
          </p>
        ) : !generation ? (
          <p className="text-xs italic text-[var(--text-muted)]">
            Waiting for prompt...
          </p>
        ) : null}

      </div>

      {/* Input Images (Compact) */}
      {generation && validInputImages.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          {validInputImages.map((image, index) => (
            <button
              key={image.id ?? `${generation.id}-input-${index}`}
              type="button"
              onClick={() => onPreviewInputImage?.(image)}
              className="relative block h-8 w-8 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] transition-transform hover:scale-110 hover:border-[var(--text-muted)] focus:outline-none"
              title="View reference image"
            >
              <Image
                src={image.url}
                alt={image.name || "Reference image"}
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
      {generation && !isInterrupted && (
        <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 gap-y-2">
            {/* Tech Badges */}
            <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                    {getQualityLabel(generation.quality)}
                </span>
                <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                    {aspectLabel ?? "Custom"}
                </span>
            {generation.useGoogleSearch ? (
                  <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                    Search
                  </span>
                ) : null}
            </div>

            {/* Compact Actions */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onUsePrompt(generation.prompt, validInputImages)}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title="Reuse prompt in editor"
                >
                    <ReuseIcon className="h-3.5 w-3.5" />
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
      
      {/* Delete Action for Interrupted State */}
      {isInterrupted && canDelete && onDeleteGeneration && (
         <div className="mt-auto pt-2 border-t border-[var(--border-subtle)] flex justify-end">
            <button
                type="button"
                onClick={() => onDeleteGeneration(generation!.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-950/30 text-[10px] font-semibold text-red-400/80 hover:text-red-400 transition-colors"
            >
                <TrashIcon className="h-3 w-3" />
                Discard
            </button>
         </div>
      )}
    </section>
  );
}
