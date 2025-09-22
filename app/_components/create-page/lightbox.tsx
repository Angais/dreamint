import Image from "next/image";
import { useEffect, useRef } from "react";
import type { WheelEvent } from "react";

import {
  formatResolution,
  getAspectDescription,
  getQualityLabel,
} from "../../lib/seedream-options";
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
    event.preventDefault();
    event.stopPropagation();

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 outline-none"
      onWheel={handleWheel}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        aria-label="Close image"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-[#1c1d27] bg-[#0f1017] p-6 shadow-[0_45px_120px_-50px_rgba(0,0,0,0.9)]">
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-full border border-[#2a2b36] bg-[#151620] px-3 py-1 text-xs font-semibold text-[#dcdde5] transition-colors hover:border-[#343545]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#181922] bg-black/30">
          <div className="relative flex max-h-[70vh] w-full items-center justify-center">
            {canGoPrev ? (
              <button
                type="button"
                aria-label="Previous image"
                className="group absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrev();
                }}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
            ) : null}
            <Image
              src={entry.src}
              alt={entry.prompt}
              width={entry.size.width}
              height={entry.size.height}
              className="max-h-[70vh] w-auto max-w-full select-none object-contain"
              draggable={false}
              priority
            />
            {canGoNext ? (
              <button
                type="button"
                aria-label="Next image"
                className="group absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                onClick={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
              >
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 text-sm text-[#cfd0da]">
          <p className="text-base font-medium text-white">{entry.prompt}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border[#222330] bg-[#15161f] px-3 py-1 text-[#a7a9ba]">
              {getAspectDescription(entry.aspect)}
            </span>
            <span className="rounded-full border border[#222330] bg-[#15161f] px-3 py-1 text-[#a7a9ba]">
              {getQualityLabel(entry.quality)} - {formatResolution(entry.size)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-full border border[#2a2b36] bg-[#151620] px-5 py-2.5 text-sm font-semibold text-[#dcdde5] transition-colors hover:border-[#343545] disabled:cursor-not-allowed disabled:border-[#2a2b36] disabled:text-[#77798a]"
            >
              {isDownloading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
              {isDownloading ? "Preparing" : "Download"}
            </button>
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-2 rounded-full border border[#2a2b36] bg-[#13141c] px-5 py-2.5 text-sm font-semibold text-[#dcdde5] transition-colors hover:border-[#343545]"
              >
                <PlusIcon className="h-4 w-4" />
                Edit
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

