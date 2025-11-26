import Image from "next/image";
import { useEffect, useRef } from "react";
import type { WheelEvent } from "react";

import { getAspectDescription, getQualityLabel } from "../../lib/seedream-options";
import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon, PlusIcon, SpinnerIcon } from "./icons";
import type { GalleryEntry } from "./types";

type LightboxProps = {
  entry: GalleryEntry;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onEdit?: () => void;
};

export function Lightbox({
  entry,
  onClose,
  onDownload,
  isDownloading,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  onEdit,
}: LightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.focus();
  }, [entry.src]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && canGoPrev) {
        event.preventDefault();
        onPrev();
      }

      if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        onNext();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [onPrev, onNext, onClose, canGoPrev, canGoNext]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY > 0 && canGoNext) {
      onNext();
    } else if (event.deltaY < 0 && canGoPrev) {
      onPrev();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/95 backdrop-blur-sm px-4 py-8 outline-none animate-in fade-in duration-200"
      onWheel={handleWheel}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        aria-label="Close image"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-6xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden">
        
        {/* Image Container */}
        <div className="relative flex-1 bg-black/50 rounded-xl overflow-hidden flex items-center justify-center min-h-[50vh] md:min-h-[70vh]">
            {canGoPrev ? (
              <button
                type="button"
                aria-label="Previous image"
                className="group absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white backdrop-blur transition hover:bg-white hover:text-black hover:shadow-lg focus:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrev();
                }}
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            ) : null}
            
            <Image
              src={entry.src}
              alt={entry.prompt}
              width={entry.size.width}
              height={entry.size.height}
              className="max-h-[70vh] w-auto max-w-full select-none object-contain shadow-lg"
              draggable={false}
              priority
            />
            
            {canGoNext ? (
              <button
                type="button"
                aria-label="Next image"
                className="group absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white backdrop-blur transition hover:bg-white hover:text-black hover:shadow-lg focus:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
              >
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            ) : null}
        </div>

        {/* Sidebar for Details */}
        <div className="w-full md:w-[320px] bg-[var(--bg-panel)] p-6 flex flex-col border-l border-[var(--border-subtle)]">
           <div className="flex justify-between items-start mb-6">
             <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Details</h2>
              <button
                type="button"
                className="rounded-md p-2 -mt-2 -mr-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)]"
                onClick={onClose}
              >
                 <span className="text-xs font-bold">ESC</span>
              </button>
           </div>

           <div className="flex-1 overflow-y-auto pr-2">
             <p className="text-sm leading-relaxed text-[var(--text-primary)] font-medium mb-4">
               {entry.prompt}
             </p>
             
             <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-secondary)] mb-6">
                <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-1">Aspect</span>
                  {getAspectDescription(entry.aspect)}
                </div>
                <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-1">Quality</span>
                  {getQualityLabel(entry.quality)}
                </div>
             </div>
           </div>

           <div className="mt-auto pt-6 border-t border-[var(--border-subtle)] space-y-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={onDownload}
                disabled={isDownloading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-3 text-sm font-bold text-black shadow-lg shadow-sky-900/20 transition-all hover:bg-gray-200 hover:shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
                {isDownloading ? "Saving..." : "Download Image"}
              </button>
              
              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-white hover:border-[var(--text-muted)]"
                >
                  <PlusIcon className="h-4 w-4" />
                  Use as Reference
                </button>
              ) : null}
           </div>
        </div>
      </div>
    </div>
  );
}
