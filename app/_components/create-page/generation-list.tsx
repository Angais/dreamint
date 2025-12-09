import Image from "next/image";
import { memo } from "react";

import { type AspectKey } from "../../lib/seedream-options";
import { GenerationDetailsCard } from "./generation-details-card";
import { debugLog } from "./logger";
import type { Generation } from "./types";

type GenerationGroupProps = {
  label: string;
  generations: Generation[];
  pendingIdSet: Set<string>;
  onExpand: (generationId: string, imageIndex: number) => void;
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"]) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration: (generationId: string) => void;
  onRetryGeneration?: (generationId: string) => void;
};

export const GenerationGroup = memo(function GenerationGroup({
  label,
  generations,
  pendingIdSet,
  onExpand,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
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
          const isInterrupted = !isGenerating && generation.images.some((img) => !img);

          return (
            <div
              key={generation.id}
              className="flex flex-col gap-6 lg:flex-row lg:items-start group"
            >
              <div className="w-full lg:flex-1 lg:min-w-0">
                <GenerationGallery
                  generation={generation}
                  onExpand={onExpand}
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
                  canDelete={!isGenerating}
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
  isInterrupted: boolean;
  isGenerating: boolean;
};

const GenerationGallery = memo(function GenerationGallery({
  generation,
  onExpand,
  isInterrupted,
  isGenerating,
}: GenerationGalleryProps) {
  const layout = resolveGalleryLayout(generation);

  debugLog("gallery:render", {
    generationId: generation.id,
    aspect: generation.aspect,
    imageCount: generation.images.length,
    tileClass: layout.tileClass,
    gridClass: layout.gridClass,
    layoutSource: layout.source,
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
  generationId: string;
  imageIndex: number;
  size: { width: number; height: number };
  isInterrupted: boolean;
  isGenerating: boolean;
};

const ImageTile = memo(function ImageTile({
  src,
  className,
  prompt,
  onExpand,
  generationId,
  imageIndex,
  size,
  isInterrupted,
  isGenerating,
}: ImageTileProps) {
  const width = Math.max(size?.width ?? 1024, 256);
  const height = Math.max(size?.height ?? 1024, 256);
  const maxDimension = Math.max(width, height);
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const desiredPixelWidth = Math.max(
    width,
    height,
    Math.ceil(Math.max(width, height) * devicePixelRatio),
  );

  const shouldBypassOptimization = false;

  if (!src) {
    const interruptedStyles = isInterrupted
      ? "bg-[#1f1f1f] border border-red-700/60 text-red-300"
      : "animate-pulse bg-[#1f1f1f] border border-[#333]";

    return (
      <div className={`${className} relative ${interruptedStyles}`}>
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">
            {isGenerating ? "Generating..." : "Loading"}
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
      <Image
        src={src}
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

const GRID_CLASS_MAP: Record<AspectKey, string> = {
  "square-1-1": "grid grid-cols-2 gap-0.5",
  "portrait-2-3": "grid grid-cols-2 gap-0.5",
  "portrait-3-4": "grid grid-cols-2 gap-0.5",
  "portrait-4-5": "grid grid-cols-2 gap-0.5",
  "portrait-9-16": "grid grid-cols-2 gap-0.5",
  "landscape-3-2": "grid grid-cols-2 gap-0.5",
  "landscape-4-3": "grid grid-cols-2 gap-0.5",
  "landscape-5-4": "grid grid-cols-2 gap-0.5",
  "landscape-16-9": "grid grid-cols-2 gap-0.5",
  "landscape-21-9": "grid grid-cols-2 gap-0.5",
};

const TILE_CLASS_MAP: Record<AspectKey, string> = {
  "square-1-1": "relative aspect-square overflow-hidden",
  "portrait-2-3": "relative aspect-[2/3] overflow-hidden",
  "portrait-3-4": "relative aspect-[3/4] overflow-hidden",
  "portrait-4-5": "relative aspect-[4/5] overflow-hidden",
  "portrait-9-16": "relative aspect-[9/16] overflow-hidden",
  "landscape-3-2": "relative aspect-[3/2] overflow-hidden",
  "landscape-4-3": "relative aspect-[4/3] overflow-hidden",
  "landscape-5-4": "relative aspect-[5/4] overflow-hidden",
  "landscape-16-9": "relative aspect-[16/9] overflow-hidden",
  "landscape-21-9": "relative aspect-[21/9] overflow-hidden",
};

const DEFAULT_GRID_CLASS = "grid grid-cols-2 gap-0.5";
const DEFAULT_TILE_CLASS = "relative aspect-square overflow-hidden";

type GalleryLayout = {
  gridClass: string;
  tileClass: string;
  source: "preset" | "custom";
  ratio: number | null;
};

function resolveGalleryLayout(generation: Generation): GalleryLayout {
  const imageCount = generation.images.length;

  if (generation.aspect !== "custom") {
    let gridClass = GRID_CLASS_MAP[generation.aspect];

    if (imageCount === 1) {
      gridClass = "grid grid-cols-1 lg:grid-cols-2";
    } else if (imageCount === 2 && generation.aspect.startsWith("landscape")) {
      gridClass = "grid grid-cols-1 gap-0.5 lg:grid-cols-2";
    }

    return {
      gridClass,
      tileClass: TILE_CLASS_MAP[generation.aspect],
      source: "preset",
      ratio: null,
    };
  }

  const width = Number(generation.size?.width ?? 0);
  const height = Number(generation.size?.height ?? 0);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: DEFAULT_TILE_CLASS,
      source: "custom",
      ratio: null,
    };
  }

  const ratio = width / height;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: DEFAULT_TILE_CLASS,
      source: "custom",
      ratio: null,
    };
  }

  let gridClass = DEFAULT_GRID_CLASS;
  if (imageCount === 1) {
    gridClass = "grid grid-cols-1 lg:grid-cols-2";
  } else if (imageCount === 2 && ratio > 1.1) {
    gridClass = "grid grid-cols-1 gap-0.5 lg:grid-cols-2";
  }

  if (ratio >= 2.2) {
    return {
      gridClass,
      tileClass: "relative aspect-[21/9] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 1.7) {
    return {
      gridClass,
      tileClass: "relative aspect-[16/9] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 1.3) {
    return {
      gridClass,
      tileClass: "relative aspect-[3/2] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 0.9) {
    return {
      gridClass,
      tileClass: "relative aspect-square overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 0.7) {
    return {
      gridClass,
      tileClass: "relative aspect-[4/5] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  return {
    gridClass,
    tileClass: "relative aspect-[9/16] overflow-hidden",
    source: "custom",
    ratio,
  };
}
