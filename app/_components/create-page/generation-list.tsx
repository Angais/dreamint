import Image from "next/image";
import { memo, useMemo, useState } from "react";

import { type AspectKey } from "../../lib/seedream-options";
import { GenerationDetailsCard } from "./generation-details-card";
import { CopyIcon, DownloadIcon, InfoIcon } from "./icons";
import { debugLog } from "./logger";
import type { Generation, ImageThoughts } from "./types";
import { parseThoughtText, renderMarkdownBold } from "./utils";

type GenerationGroupProps = {
  label: string;
  generations: Generation[];
  pendingIdSet: Set<string>;
  streamingThoughts?: Map<string, (ImageThoughts | null)[]>;
  onExpand: (generationId: string, imageIndex: number) => void;
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"], useGoogleSearch?: boolean) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration: (generationId: string) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onShareCollage: (generationId: string) => Promise<boolean>;
  onRetryGeneration?: (generationId: string) => void;
  onShowThoughts?: (thoughts: ImageThoughts) => void;
};

export const GenerationGroup = memo(function GenerationGroup({
  label,
  generations,
  pendingIdSet,
  streamingThoughts,
  onExpand,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
  onDeleteImage,
  onDownloadImage,
  onCopyImage,
  onShareCollage,
  onRetryGeneration,
  onShowThoughts,
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

          return (
            <div
              key={generation.id}
              className="flex flex-col gap-6 lg:flex-row lg:items-start group"
            >
              <div className="w-full lg:flex-1 lg:min-w-0">
                <GenerationGallery
                  generation={generation}
                  streamingThoughts={streamingThoughts?.get(generation.id)}
                  onExpand={onExpand}
                  onDeleteImage={onDeleteImage}
                  onDownloadImage={onDownloadImage}
                  onCopyImage={onCopyImage}
                  onShowThoughts={onShowThoughts}
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
  streamingThoughts?: (ImageThoughts | null)[];
  onExpand: (generationId: string, imageIndex: number) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onShowThoughts?: (thoughts: ImageThoughts) => void;
  isInterrupted: boolean;
  isGenerating: boolean;
};

const GenerationGallery = memo(function GenerationGallery({
  generation,
  streamingThoughts,
  onExpand,
  onDeleteImage,
  onDownloadImage,
  onCopyImage,
  onShowThoughts,
  isInterrupted,
  isGenerating,
}: GenerationGalleryProps) {
  const layout = resolveGalleryLayout(generation);
  const deletedSet = useMemo(() => new Set(generation.deletedImages ?? []), [generation.deletedImages]);

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
        {generation.images.map((src, index) => {
          // Use streaming thoughts if available (during generation), otherwise use static thoughts
          const thoughts = streamingThoughts?.[index] ?? generation.thoughts?.[index] ?? null;
          return (
            <ImageTile
              key={`${generation.id}-${index}`}
              src={src}
              className={layout.tileClass}
              prompt={generation.prompt}
              onExpand={() => onExpand(generation.id, index)}
              onDelete={() => onDeleteImage(generation.id, index)}
              onDownload={() => onDownloadImage(generation.id, index)}
              onCopy={() => onCopyImage(generation.id, index)}
              onShowThoughts={thoughts && onShowThoughts ? () => onShowThoughts(thoughts) : undefined}
              thoughts={thoughts}
              isDeleted={deletedSet.has(index)}
              generationId={generation.id}
              imageIndex={index}
              size={generation.size}
              isInterrupted={isInterrupted}
              isGenerating={isGenerating}
              provider={generation.provider}
            />
          );
        })}
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
  onShowThoughts?: () => void;
  thoughts: ImageThoughts | null;
  isDeleted: boolean;
  generationId: string;
  imageIndex: number;
  size: { width: number; height: number };
  isInterrupted: boolean;
  isGenerating: boolean;
  provider?: string;
};

const ImageTile = memo(function ImageTile({
  src,
  className,
  prompt,
  onExpand,
  onDelete,
  onDownload,
  onCopy,
  onShowThoughts,
  thoughts,
  isDeleted,
  generationId,
  imageIndex,
  size,
  isInterrupted,
  isGenerating,
  provider,
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

  const shouldBypassOptimization = false;

  if (!src) {
    if (isDeleted) {
      return (
        <div className={`${className} relative bg-[#0f1017] border border-[var(--border-subtle)] text-[var(--text-muted)]`}>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide">
            Deleted
          </div>
        </div>
      );
    }

    const interruptedStyles = isInterrupted
      ? "bg-[#1f1f1f] border border-red-700/60 text-red-300"
      : "bg-[#1f1f1f] border border-[#333]";

    const isGemini = provider === "gemini";

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
            {isGemini ? (
              <>
                {/* Header with thinking indicator */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 rounded-full blur-md animate-pulse" />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="relative h-4 w-4 text-white/70 animate-spin"
                      style={{ animationDuration: "1.5s" }}
                    >
                      <path d="M12 2v4" />
                      <path d="M12 18v4" />
                      <path d="M4.93 4.93l2.83 2.83" />
                      <path d="M16.24 16.24l2.83 2.83" />
                      <path d="M2 12h4" />
                      <path d="M18 12h4" />
                      <path d="M4.93 19.07l2.83-2.83" />
                      <path d="M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium tracking-wide text-white/70">Chain of Thought</span>
                </div>

                {/* Scrollable thoughts content */}
                {thoughts?.text && thoughts.text.length > 0 ? (
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {(() => {
                      const latestThought = thoughts.text[thoughts.text.length - 1];
                      const { title, body } = parseThoughtText(latestThought);
                      return (
                        <div className="space-y-2">
                          {title && (
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/90">
                              {title}
                            </h4>
                          )}
                          {body && (
                            <p className="text-[13px] leading-[1.7] text-white/60 font-light">
                              {renderMarkdownBold(body, "font-medium text-white/80")}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/30">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-white/40">Reasoning...</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">
                Generating...
              </div>
            )}
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
          {onShowThoughts && thoughts && ((thoughts.text?.length ?? 0) > 0 || (thoughts.images?.length ?? 0) > 0) && (
            <div
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                onShowThoughts();
              }}
              className="rounded-full bg-black/70 p-1.5 text-white hover:bg-indigo-600/80 transition-colors duration-150"
              aria-label="View chain of thought"
              title="View chain of thought"
            >
              <InfoIcon className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      ) : null}
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
