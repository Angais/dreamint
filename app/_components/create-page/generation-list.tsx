import Image from "next/image";

import { type AspectKey } from "../../lib/seedream-options";
import { GenerationDetailsCard } from "./generation-details-card";
import { debugLog } from "./logger";
import type { Generation } from "./types";

type GenerationGroupProps = {
  label: string;
  generations: Generation[];
  pendingIdSet: Set<string>;
  errorGenerationId: string | null;
  errorMessage: string | null;
  onExpand: (generationId: string, imageIndex: number) => void;
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"]) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration: (generationId: string) => void;
};

export function GenerationGroup({
  label,
  generations,
  pendingIdSet,
  errorGenerationId,
  errorMessage,
  onExpand,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
}: GenerationGroupProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-[#6a6c7b]">
        {label}
      </h2>
      <div className="space-y-10">
        {generations.map((generation) => {
          const isGenerating = pendingIdSet.has(generation.id);
          const cardError = generation.id === errorGenerationId ? errorMessage : null;

          return (
            <div
              key={generation.id}
              className="flex flex-col gap-6 lg:flex-row lg:items-start"
            >
              <div className="w-full lg:flex-1 lg:min-w-0">
                <GenerationGallery generation={generation} onExpand={onExpand} />
              </div>
              <div className="w-full max-w-[180px] lg:w-44 lg:basis-44 lg:flex-none lg:self-start lg:shrink-0">
                <GenerationDetailsCard
                  generation={generation}
                  isGenerating={isGenerating}
                  errorMessage={cardError}
                  onUsePrompt={onUsePrompt}
                  onPreviewInputImage={onPreviewInputImage}
                  onDeleteGeneration={onDeleteGeneration}
                  canDelete={!isGenerating}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type GenerationGalleryProps = {
  generation: Generation;
  onExpand: (generationId: string, imageIndex: number) => void;
};

function GenerationGallery({ generation, onExpand }: GenerationGalleryProps) {
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
    <article className="w-full rounded-3xl border border-[#171822] bg-[#101117] shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)]">
      <div className={`${layout.gridClass} overflow-hidden rounded-3xl border border-[#181922] bg-[#0c0d14] p-4`}>
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
          />
        ))}
      </div>
    </article>
  );
}

type ImageTileProps = {
  src: string;
  className: string;
  prompt: string;
  onExpand: () => void;
  generationId: string;
  imageIndex: number;
  size: { width: number; height: number };
};

function ImageTile({ src, className, prompt, onExpand, generationId, imageIndex, size }: ImageTileProps) {
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
    return (
      <div className={`${className} animate-pulse rounded-2xl border border-dashed border[#20212d] bg-[#0f1017]`} />
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`${className} rounded-2xl border border[#1a1b24] bg-[#0f1017] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#e9eaef]/30 cursor-pointer`}
      aria-label="Expand image"
    >
      <Image
        src={src}
        alt={prompt}
        width={width}
        height={height}
        draggable={false}
        sizes="(max-width: 640px) calc((100vw - 2.5rem) / 2), (max-width: 1024px) calc((100vw - 4rem) / 2), calc((min(1400px, 100vw) - 4rem) / 4)"
        quality={100}
        unoptimized={shouldBypassOptimization}
        loading={shouldBypassOptimization ? "eager" : "lazy"}
        className="h-full w-full object-cover select-none"
        onLoadingComplete={(image) => {
          debugLog("gallery:image-loaded", {
            generationId,
            imageIndex,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            renderedWidth: image.width,
            renderedHeight: image.height,
            devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : null,
            requestedWidth: width,
            requestedHeight: height,
            desiredPixelWidth,
            maxDimension,
            shouldBypassOptimization,
          });
        }}
        style={{
          imageRendering: "high-quality",
          WebkitImageRendering: "optimizeQuality",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          filter: devicePixelRatio > 1 ? "none" : undefined,
        }}
      />
    </button>
  );
}

const GRID_CLASS_MAP: Record<AspectKey, string> = {
  "square-1-1": "grid grid-cols-2 gap-3",
  "portrait-4-5": "grid grid-cols-2 gap-3 lg:grid-cols-4",
  "portrait-9-16": "grid grid-cols-2 gap-3 lg:grid-cols-4",
  "landscape-3-2": "grid grid-cols-2 gap-3 lg:grid-cols-4",
  "landscape-16-9": "grid grid-cols-2 gap-3 lg:grid-cols-4",
  "landscape-21-9": "grid grid-cols-2 gap-3 lg:grid-cols-4",
};

const TILE_CLASS_MAP: Record<AspectKey, string> = {
  "square-1-1": "relative aspect-square overflow-hidden",
  "portrait-4-5": "relative aspect-[4/5] overflow-hidden",
  "portrait-9-16": "relative aspect-[9/16] overflow-hidden",
  "landscape-3-2": "relative aspect-[3/2] overflow-hidden",
  "landscape-16-9": "relative aspect-[16/9] overflow-hidden",
  "landscape-21-9": "relative aspect-[21/9] overflow-hidden",
};

const DEFAULT_GRID_CLASS = "grid grid-cols-2 gap-3 lg:grid-cols-4";
const DEFAULT_TILE_CLASS = "relative aspect-square overflow-hidden";

type GalleryLayout = {
  gridClass: string;
  tileClass: string;
  source: "preset" | "custom";
  ratio: number | null;
};

function resolveGalleryLayout(generation: Generation): GalleryLayout {
  if (generation.aspect !== "custom") {
    return {
      gridClass: GRID_CLASS_MAP[generation.aspect],
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

  if (ratio >= 2.2) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: "relative aspect-[21/9] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 1.7) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: "relative aspect-[16/9] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 1.3) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: "relative aspect-[3/2] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 0.9) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: "relative aspect-square overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  if (ratio >= 0.7) {
    return {
      gridClass: DEFAULT_GRID_CLASS,
      tileClass: "relative aspect-[4/5] overflow-hidden",
      source: "custom",
      ratio,
    };
  }

  return {
    gridClass: DEFAULT_GRID_CLASS,
    tileClass: "relative aspect-[9/16] overflow-hidden",
    source: "custom",
    ratio,
  };
}
