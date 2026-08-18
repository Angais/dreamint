import Image from "next/image";
import { memo, useMemo, useState } from "react";

import { GenerationDetailsCard } from "./generation-details-card";
import { CopyIcon, DownloadIcon } from "./icons";
import { debugLog } from "./logger";
import type { Generation, ReusePromptOptions } from "./types";
import { useResolvedImageSource } from "./use-resolved-image-source";

type GenerationGroupProps = {
  label: string;
  generations: Generation[];
  pendingIdSet: Set<string>;
  retryingGenerationIds: Set<string>;
  onExpand: (generationId: string, imageIndex: number) => void;
  onUsePrompt: (
    prompt: string,
    inputImages: Generation["inputImages"],
    options?: ReusePromptOptions,
  ) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration: (generationId: string) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onShareCollage: (generationId: string) => Promise<boolean>;
  onRetryGeneration?: (generationId: string) => void;
};

export const GenerationGroup = memo(function GenerationGroup({
  label,
  generations,
  pendingIdSet,
  retryingGenerationIds,
  onExpand,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
  onDeleteImage,
  onDownloadImage,
  onCopyImage,
  onShareCollage,
  onRetryGeneration,
}: GenerationGroupProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-text-muted pl-1">
        {label}
      </h2>
      <div className="space-y-10">
        {generations.map((generation) => {
          const isGenerating = pendingIdSet.has(generation.id);
          const deletedSet = new Set(generation.deletedImages ?? []);
          const isInterrupted =
            !isGenerating &&
            generation.images.some((img, index) => !img && !deletedSet.has(index));
          const isRetrying = retryingGenerationIds.has(generation.id);

          return (
            <div
              key={generation.id}
              className="flex flex-col gap-6 lg:flex-row lg:items-start group"
            >
              <div className="w-full lg:flex-1 lg:min-w-0">
                <GenerationGallery
                  generation={generation}
                  onExpand={onExpand}
                  onDeleteImage={onDeleteImage}
                  onDownloadImage={onDownloadImage}
                  onCopyImage={onCopyImage}
                  isInterrupted={isInterrupted}
                  isGenerating={isGenerating}
                />
              </div>
              <div className="w-full lg:max-w-[180px] lg:w-44 lg:basis-44 lg:flex-none lg:self-start lg:shrink-0 transition-opacity duration-300 lg:opacity-80 lg:group-hover:opacity-100">
                <GenerationDetailsCard
                  generation={generation}
                  isGenerating={isGenerating}
                  onUsePrompt={onUsePrompt}
                  onPreviewInputImage={onPreviewInputImage}
                  onDeleteGeneration={onDeleteGeneration}
                  onShareCollage={onShareCollage}
                  canDelete={!isGenerating}
                  isRetrying={isRetrying}
                  onRetry={onRetryGeneration ? () => onRetryGeneration(generation.id) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

type GenerationGalleryProps = {
  generation: Generation;
  onExpand: (generationId: string, imageIndex: number) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  isInterrupted: boolean;
  isGenerating: boolean;
};

const GenerationGallery = memo(function GenerationGallery({
  generation,
  onExpand,
  onDeleteImage,
  onDownloadImage,
  onCopyImage,
  isInterrupted,
  isGenerating,
}: GenerationGalleryProps) {
  const layout = resolveGalleryLayout(generation);
  const deletedSet = useMemo(() => new Set(generation.deletedImages ?? []), [generation.deletedImages]);

  debugLog("gallery:render", {
    generationId: generation.id,
    aspectRatio: generation.aspectRatio,
    imageCount: generation.images.length,
    tileClass: layout.tileClass,
    gridClass: layout.gridClass,
    ratio: layout.ratio,
    size: generation.size,
  });

  return (
    <article className="glass-panel w-full rounded-3xl p-1 shadow-2xl transition-all duration-300 hover:shadow-[0_0_30px_-10px_rgba(99,102,241,0.15)]">
      <div className={`${layout.gridClass} overflow-hidden rounded-[20px] bg-[rgba(0,0,0,0.3)]`}>
        {generation.images.map((src, index) => (
          <ImageTile
            key={`${generation.id}-${index}`}
            src={src}
            className={layout.tileClass}
            prompt={generation.prompt}
            onExpand={() => onExpand(generation.id, index)}
            onDelete={() => onDeleteImage(generation.id, index)}
            onDownload={() => onDownloadImage(generation.id, index)}
            onCopy={() => onCopyImage(generation.id, index)}
            isDeleted={deletedSet.has(index)}
            generationId={generation.id}
            imageIndex={index}
            size={generation.size}
            isInterrupted={isInterrupted}
            isGenerating={isGenerating}
          />
        ))}
      </div>
    </article>
  );
});

type ImageTileProps = {
  src: string;
  className: string;
  prompt: string;
  onExpand: () => void;
  onDelete: () => void;
  onDownload: () => Promise<boolean>;
  onCopy: () => Promise<boolean>;
  isDeleted: boolean;
  generationId: string;
  imageIndex: number;
  size: { width: number; height: number };
  isInterrupted: boolean;
  isGenerating: boolean;
};

function ImageLoading() {
  return (
    <div className="relative flex-1 overflow-hidden bg-[#101010]">
      <div aria-hidden="true" className="image-loading-grid" />
      <div aria-hidden="true" className="image-loading-scan" />
      <div aria-hidden="true" className="image-loading-frame" />
      <div className="relative z-10 flex h-full min-h-0 items-start justify-center p-3 pt-[18%]">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <div className="image-loading-aperture" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="max-w-full truncate text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            Generating
          </div>
          <div className="max-w-full truncate text-[9px] font-medium uppercase tracking-[0.18em] text-white/35">
            Composing pixels
          </div>
        </div>
      </div>
    </div>
  );
}

const ImageTile = memo(function ImageTile({
  src,
  className,
  prompt,
  onExpand,
  onDelete,
  onDownload,
  onCopy,
  isDeleted,
  generationId,
  imageIndex,
  size,
  isInterrupted,
  isGenerating,
}: ImageTileProps) {
  const [flashAction, setFlashAction] = useState<"copy" | "download" | null>(null);
  const triggerFlash = (action: "copy" | "download") => {
    setFlashAction(action);
    window.setTimeout(() => setFlashAction((prev) => (prev === action ? null : prev)), 260);
  };

  const width = Math.max(size?.width ?? 1024, 256);
  const height = Math.max(size?.height ?? 1024, 256);
  const maxDimension = Math.max(width, height);
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const desiredPixelWidth = Math.max(
    width,
    height,
    Math.ceil(Math.max(width, height) * devicePixelRatio),
  );
  const { resolvedSource, isResolving } = useResolvedImageSource(src);
  const shouldBypassOptimization =
    resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:");

  if (!src || isResolving || !resolvedSource) {
    if (isDeleted) {
      return (
        <div className={`${className} relative bg-[#0f1017] border border-[var(--border-subtle)] text-[var(--text-muted)]`}>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide">
            Deleted
          </div>
        </div>
      );
    }

    if (isResolving) {
      return (
        <div className={`${className} relative bg-[#1f1f1f] border border-[#333] animate-pulse`}>
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">
            Loading
          </div>
        </div>
      );
    }

    const interruptedStyles = isInterrupted
      ? "bg-[#1f1f1f] border border-red-700/60 text-red-300"
      : "bg-[#1f1f1f] border border-[#333]";

    return (
      <div className={`${className} relative ${interruptedStyles} ${!isInterrupted ? "animate-pulse" : ""}`}>
        {isInterrupted ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>Interrupted</span>
            </span>
          </div>
        ) : isGenerating ? (
          <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#141414]">
            <ImageLoading />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">
            Loading
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`${className} bg-[#0f1017] transition-all duration-300 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 cursor-pointer overflow-hidden group/tile`}
      aria-label="Expand image"
    >
      {!isGenerating && !isDeleted ? (
        <div className="absolute right-2 top-2 z-10 hidden md:flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100">
          <div
            role="button"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-full bg-black/70 p-1.5 text-white hover:bg-red-900/80"
            aria-label="Delete image"
            title="Delete image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div
            role="button"
            tabIndex={-1}
            onClick={async (event) => {
              event.stopPropagation();
              const ok = await onCopy();
              if (ok) triggerFlash("copy");
            }}
            className={`rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 transition-transform duration-150 ${flashAction === "copy" ? "scale-110 ring-2 ring-white/70" : ""
              }`}
            aria-label="Copy image"
            title="Copy image"
          >
            <CopyIcon
              className={`h-3.5 w-3.5 ${flashAction === "copy" ? "copy-wiggle" : ""}`}
            />
          </div>
          <div
            role="button"
            tabIndex={-1}
            onClick={async (event) => {
              event.stopPropagation();
              const ok = await onDownload();
              if (ok) triggerFlash("download");
            }}
            className={`rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 transition-transform duration-150 ${flashAction === "download" ? "scale-110 ring-2 ring-white/70" : ""
              }`}
            aria-label="Download image"
            title="Download image"
          >
            <DownloadIcon
              className={`h-3.5 w-3.5 ${flashAction === "download" ? "download-nudge" : ""}`}
            />
          </div>
        </div>
      ) : null}
      <Image
        src={resolvedSource}
        alt={prompt}
        width={width}
        height={height}
        draggable={false}
        sizes="(max-width: 640px) calc((100vw - 2.5rem) / 2), (max-width: 1024px) calc((100vw - 4rem) / 2), calc((min(1400px, 100vw) - 4rem) / 4)"
        unoptimized={shouldBypassOptimization}
        loading={shouldBypassOptimization ? "eager" : "lazy"}
        className="h-full w-full object-cover select-none transition-transform duration-500 group-hover/tile:scale-105"
        onLoad={({ currentTarget }) => {
          debugLog("gallery:image-loaded", {
            generationId,
            imageIndex,
            naturalWidth: currentTarget.naturalWidth,
            naturalHeight: currentTarget.naturalHeight,
            renderedWidth: currentTarget.width,
            renderedHeight: currentTarget.height,
            devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : null,
            requestedWidth: width,
            requestedHeight: height,
            desiredPixelWidth,
            maxDimension,
            shouldBypassOptimization,
          });
        }}
        style={{
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          filter: devicePixelRatio > 1 ? "none" : undefined,
        }}
      />
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover/tile:bg-black/10" />
    </button>
  );
});

const DEFAULT_GRID_CLASS = "grid grid-cols-2 gap-0.5";
const DEFAULT_TILE_CLASS = "relative aspect-square overflow-hidden";

type GalleryLayout = {
  gridClass: string;
  tileClass: string;
  ratio: number | null;
};

function resolveGalleryLayout(generation: Generation): GalleryLayout {
  const imageCount = generation.images.length;
  const width = Number(generation.size?.width ?? 0);
  const height = Number(generation.size?.height ?? 0);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: DEFAULT_TILE_CLASS,
      ratio: null,
    };
  }

  const ratio = width / height;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: DEFAULT_TILE_CLASS,
      ratio: null,
    };
  }

  // Portrait batches get more, narrower columns so tall images don't take
  // over the feed: four 9:16 outputs render as one row of four on desktop.
  const isPortrait = ratio < 0.9;

  let gridClass = DEFAULT_GRID_CLASS;
  if (isPortrait) {
    if (imageCount === 1) {
      gridClass = "grid grid-cols-2 gap-0.5 lg:grid-cols-3";
    } else if (imageCount === 3) {
      gridClass = "grid grid-cols-2 gap-0.5 lg:grid-cols-3";
    } else {
      gridClass = "grid grid-cols-2 gap-0.5 lg:grid-cols-4";
    }
  } else if (imageCount === 1) {
    gridClass = "grid grid-cols-1 lg:grid-cols-2";
  } else if (imageCount === 2 && ratio > 1.1) {
    gridClass = "grid grid-cols-1 gap-0.5 lg:grid-cols-2";
  }

  if (ratio >= 2.2) {
    return { gridClass, tileClass: "relative aspect-[21/9] overflow-hidden", ratio };
  }

  if (ratio >= 1.7) {
    return { gridClass, tileClass: "relative aspect-[16/9] overflow-hidden", ratio };
  }

  if (ratio >= 1.3) {
    return { gridClass, tileClass: "relative aspect-[3/2] overflow-hidden", ratio };
  }

  if (ratio >= 0.9) {
    return { gridClass, tileClass: "relative aspect-square overflow-hidden", ratio };
  }

  if (ratio >= 0.7) {
    return { gridClass, tileClass: "relative aspect-[4/5] overflow-hidden", ratio };
  }

  return { gridClass, tileClass: "relative aspect-[9/16] overflow-hidden", ratio };
}
