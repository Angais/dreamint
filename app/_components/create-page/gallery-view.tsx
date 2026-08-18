"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { convertBlobToOutputFormat, extensionFromMimeType } from "./download-utils";
import { CopyIcon, DownloadIcon, MagnifyingGlassIcon, SpinnerIcon, XIcon } from "./icons";
import { isStoredAssetRef, resolveStoredAssetBlob } from "./storage";
import type { Generation } from "./types";
import { useInfiniteScroll } from "./use-infinite-scroll";
import { useResolvedImageSource } from "./use-resolved-image-source";

type GalleryViewProps = {
  generations: Generation[];
  onExpand: (generationId: string, imageIndex: number) => void;
  onDeleteImages: (items: Array<{ generationId: string; imageIndex: number }>) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
};

type GallerySort = "newest" | "oldest";

const GALLERY_PREFERENCES_KEY = "dreamint:gallery_preferences";

function parseGallerySort(value: string | null): GallerySort | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { sort?: unknown };
    return parsed?.sort === "oldest" ? "oldest" : parsed?.sort === "newest" ? "newest" : null;
  } catch {
    return null;
  }
}

async function sourceToBlob(source: string): Promise<Blob | null> {
  if (isStoredAssetRef(source)) {
    return resolveStoredAssetBlob(source);
  }

  try {
    const response = await fetch(source);
    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
}

type GalleryItem = {
  id: string;
  index: number;
  src: string;
  fullSrc: string;
  outputFormat: Generation["outputFormat"];
  model: string;
  modelLabel?: string;
  prompt: string;
  aspectRatio: string;
  resolution?: string | null;
  createdAt: string;
  size: { width: number; height: number };
};

function buildSearchText(item: GalleryItem): string {
  return [
    item.prompt,
    item.id.slice(0, 8),
    item.model,
    item.modelLabel,
    item.outputFormat ?? "png",
    item.resolution,
    item.aspectRatio,
    `${item.size.width}x${item.size.height}`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GalleryView({ generations, onExpand, onDeleteImages, onDeleteImage, onDownloadImage, onCopyImage }: GalleryViewProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GallerySort>("newest");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [flash, setFlash] = useState<{ key: string; action: "copy" | "download" } | null>(null);
  const preferencesHydratedRef = useRef(false);
  const { limit, loadMoreRef } = useInfiniteScroll({
    initialLimit: 30,
    increment: 30,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSort = parseGallerySort(window.localStorage.getItem(GALLERY_PREFERENCES_KEY));
    if (storedSort) {
      setSort(storedSort);
    }

    preferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(GALLERY_PREFERENCES_KEY, JSON.stringify({ sort }));
    } catch (error) {
      console.error("Unable to persist gallery preferences in localStorage", error);
    }
  }, [sort]);

  // Flatten all images into a single list for the grid
  const allImages = useMemo<GalleryItem[]>(() => {
    return generations.flatMap((gen) => {
      const deletedSet = new Set(gen.deletedImages ?? []);
      return gen.images
        .map((src, index) => ({
          id: gen.id,
          index,
          src: gen.thumbnails?.[index] || src,
          fullSrc: src,
          outputFormat: gen.outputFormat,
          model: gen.model,
          modelLabel: gen.modelLabel,
          prompt: gen.prompt,
          aspectRatio: gen.aspectRatio,
          resolution: gen.resolution,
          createdAt: gen.createdAt,
          size: gen.size,
          deleted: deletedSet.has(index),
        }))
        .filter((img) => Boolean(img.fullSrc) && !img.deleted);
    });
  }, [generations]);

  const filteredImages = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    const matches = trimmedSearch
      ? allImages.filter((img) => buildSearchText(img).includes(trimmedSearch))
      : allImages;

    return [...matches].sort((a, b) => {
      const firstTime = new Date(a.createdAt).getTime();
      const secondTime = new Date(b.createdAt).getTime();
      return sort === "newest" ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [allImages, search, sort]);

  const visibleImages = useMemo(() => filteredImages.slice(0, limit), [filteredImages, limit]);
  const imageByKey = useMemo(() => {
    const map = new Map<string, GalleryItem>();
    allImages.forEach((img) => {
      map.set(`${img.id}:${img.index}`, img);
    });
    return map;
  }, [allImages]);

  const selectedItems = useMemo(() => {
    const items: GalleryItem[] = [];
    selectedKeys.forEach((key) => {
      const item = imageByKey.get(key);
      if (item) {
        items.push(item);
      }
    });
    return items;
  }, [imageByKey, selectedKeys]);

  const filteredKeys = useMemo(
    () => filteredImages.map((img) => `${img.id}:${img.index}`),
    [filteredImages],
  );
  const hasSelectedEveryFilteredImage =
    filteredKeys.length > 0 && filteredKeys.every((key) => selectedKeys.has(key));

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
    setConfirmingDelete(false);
  }, []);

  useEffect(() => {
    if (!selectionMode) {
      clearSelection();
    }
  }, [clearSelection, selectionMode]);

  const toggleSelected = (generationId: string, imageIndex: number) => {
    const key = `${generationId}:${imageIndex}`;
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setLastSelectedKey(key);
    setConfirmingDelete(false);
  };

  const selectRangeToImage = (generationId: string, imageIndex: number) => {
    const key = `${generationId}:${imageIndex}`;
    const currentIndex = filteredKeys.indexOf(key);
    const previousIndex = lastSelectedKey ? filteredKeys.indexOf(lastSelectedKey) : -1;

    if (currentIndex === -1 || previousIndex === -1) {
      toggleSelected(generationId, imageIndex);
      return;
    }

    const rangeStart = Math.min(currentIndex, previousIndex);
    const rangeEnd = Math.max(currentIndex, previousIndex);
    const rangeKeys = filteredKeys.slice(rangeStart, rangeEnd + 1);

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      rangeKeys.forEach((rangeKey) => next.add(rangeKey));
      return next;
    });
    setLastSelectedKey(key);
    setConfirmingDelete(false);
  };

  const toggleSelectAll = () => {
    if (filteredKeys.length === 0) {
      return;
    }

    setSelectedKeys((previous) => {
      if (hasSelectedEveryFilteredImage) {
        const next = new Set(previous);
        filteredKeys.forEach((key) => next.delete(key));
        return next;
      }

      const next = new Set(previous);
      filteredKeys.forEach((key) => next.add(key));
      return next;
    });
    setLastSelectedKey(filteredKeys[filteredKeys.length - 1] ?? null);
    setConfirmingDelete(false);
  };

  const triggerFlash = useCallback((key: string, action: "copy" | "download") => {
    setFlash({ key, action });
    window.setTimeout(() => {
      setFlash((previous) =>
        previous && previous.key === key && previous.action === action ? null : previous,
      );
    }, 260);
  }, []);

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    onDeleteImages(selectedItems.map((item) => ({ generationId: item.id, imageIndex: item.index })));
    clearSelection();
  };

  const handleDownloadZip = async () => {
    if (selectedItems.length === 0 || isZipping) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const manifest: Array<Record<string, unknown>> = [];

      await Promise.all(
        selectedItems.map(async (item, i) => {
          try {
            const blob = await sourceToBlob(item.fullSrc);
            if (!blob) return;
            const downloadBlob = item.outputFormat
              ? await convertBlobToOutputFormat(blob, item.outputFormat)
              : blob;
            const ext = extensionFromMimeType(downloadBlob.type) ?? "png";
            const filename = `dreamint-${item.id.slice(0, 8)}-${item.index + 1}-${i + 1}.${ext}`;
            zip.file(filename, downloadBlob);
            manifest.push({
              filename,
              prompt: item.prompt,
              model: item.model,
              modelLabel: item.modelLabel ?? item.model,
              aspectRatio: item.aspectRatio,
              size: item.size,
              createdAt: item.createdAt,
              generationId: item.id,
              imageIndex: item.index,
            });
          } catch (error) {
            console.error("Failed to add image to zip", error);
          }
        }),
      );

      zip.file("manifest.json", JSON.stringify({ images: manifest }, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dreamint-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-5 animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <MagnifyingGlassIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${allImages.length} image${allImages.length === 1 ? "" : "s"}...`}
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-10 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-highlight)] focus:outline-none transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <XIcon className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setSort((previous) => (previous === "newest" ? "oldest" : "newest"))}
          className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
          title="Toggle sort order"
        >
          {sort === "newest" ? "Newest first" : "Oldest first"}
        </button>
        <button
          type="button"
          onClick={() => setSelectionMode((prev) => !prev)}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
            selectionMode
              ? "border-white bg-white text-black"
              : "border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
          }`}
        >
          {selectionMode ? "Done" : "Select"}
        </button>
      </div>

      {search.trim() && filteredImages.length !== allImages.length ? (
        <p className="mx-auto -mt-2 text-xs text-[var(--text-muted)]">
          {filteredImages.length} of {allImages.length} images match
        </p>
      ) : null}

      {/* Masonry grid: real aspect ratios, no cropping */}
      {visibleImages.length > 0 ? (
        <>
          <div className="columns-2 gap-1.5 sm:columns-3 lg:columns-4 xl:columns-5">
            {visibleImages.map((item) => {
              const selectionKey = `${item.id}:${item.index}`;
              const isSelected = selectedKeys.has(selectionKey);
              const flashCopy = flash?.key === selectionKey && flash.action === "copy";
              const flashDownload = flash?.key === selectionKey && flash.action === "download";
              const width = Math.max(1, Math.round(item.size?.width ?? 1));
              const height = Math.max(1, Math.round(item.size?.height ?? 1));

              return (
                <button
                  key={selectionKey}
                  type="button"
                  title={item.prompt}
                  onClick={(event) => {
                    const isModifierSelect = event.ctrlKey || event.metaKey;
                    const isRangeSelect = event.shiftKey;
                    if (selectionMode || isModifierSelect || isRangeSelect) {
                      if ((isModifierSelect || isRangeSelect) && !selectionMode) {
                        setSelectionMode(true);
                      }
                      if (isRangeSelect) {
                        selectRangeToImage(item.id, item.index);
                      } else {
                        toggleSelected(item.id, item.index);
                      }
                      return;
                    }
                    onExpand(item.id, item.index);
                  }}
                  className={`group relative mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-xl bg-[var(--bg-subtle)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    isSelected ? "ring-2 ring-white" : ""
                  }`}
                  style={{ aspectRatio: `${width} / ${height}` }}
                >
                  <GalleryImage src={item.src} alt={item.prompt} size={item.size} />
                  <div
                    className={`pointer-events-none absolute inset-0 transition-colors ${
                      isSelected ? "bg-white/20" : "bg-black/0 group-hover:bg-black/15"
                    }`}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2.5 pb-2 pt-8 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <p className="truncate text-[11px] font-medium leading-4 text-white">
                      {item.prompt}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">
                      {(item.modelLabel ?? item.model).replace(/^.*?:\s*/, "")}
                    </p>
                  </div>

                  {selectionMode ? (
                    <div className="pointer-events-none absolute right-2 top-2 z-10">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                          isSelected
                            ? "border-white bg-white"
                            : "border-white/70 bg-black/40 group-hover:border-white"
                        }`}
                      >
                        {isSelected ? (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3 text-black"
                          >
                            <path d="M4 10l4 4 8-8" />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute right-2 top-2 z-10 hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
                      <div
                        role="button"
                        tabIndex={-1}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteImage(item.id, item.index);
                        }}
                        className="rounded-full bg-black/70 p-1.5 text-white hover:bg-red-900/80"
                        aria-label="Delete image"
                        title="Delete image"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </div>
                      <div
                        role="button"
                        tabIndex={-1}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const ok = await onCopyImage(item.id, item.index);
                          if (ok) triggerFlash(selectionKey, "copy");
                        }}
                        className={`rounded-full bg-black/70 p-1.5 text-white transition-transform duration-150 hover:bg-black/90 ${
                          flashCopy ? "scale-110 ring-2 ring-white/70" : ""
                        }`}
                        aria-label="Copy image"
                        title="Copy image"
                      >
                        <CopyIcon className={`h-3.5 w-3.5 ${flashCopy ? "copy-wiggle" : ""}`} />
                      </div>
                      <div
                        role="button"
                        tabIndex={-1}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const ok = await onDownloadImage(item.id, item.index);
                          if (ok) triggerFlash(selectionKey, "download");
                        }}
                        className={`rounded-full bg-black/70 p-1.5 text-white transition-transform duration-150 hover:bg-black/90 ${
                          flashDownload ? "scale-110 ring-2 ring-white/70" : ""
                        }`}
                        aria-label="Download image"
                        title="Download image"
                      >
                        <DownloadIcon
                          className={`h-3.5 w-3.5 ${flashDownload ? "download-nudge" : ""}`}
                        />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="h-4 w-full" />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
          <p>
            {allImages.length > 0
              ? "No images match your search."
              : "No images yet — generate something first."}
          </p>
          {allImages.length > 0 && search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white"
            >
              <XIcon className="h-3.5 w-3.5" />
              Clear search
            </button>
          ) : null}
        </div>
      )}

      {/* Floating selection bar */}
      {selectionMode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[#0b0d14]/95 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur">
            <span className="px-2 text-xs font-semibold text-[var(--text-secondary)]">
              {selectedItems.length} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-white"
            >
              {hasSelectedEveryFilteredImage ? "Select none" : "Select all"}
            </button>
            {confirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500"
                >
                  <TrashIcon className="h-3 w-3" />
                  Delete {selectedItems.length}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={selectedItems.length === 0 || isZipping}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isZipping ? (
                    <SpinnerIcon className="h-3 w-3 animate-spin" />
                  ) : (
                    <DownloadIcon className="h-3 w-3" />
                  )}
                  {isZipping ? "Zipping..." : "Download ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={selectedItems.length === 0}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TrashIcon className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectionMode(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Exit selection mode"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalleryImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: { width: number; height: number };
}) {
  const { resolvedSource, isResolving } = useResolvedImageSource(src);

  if (!resolvedSource) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {isResolving ? "Loading" : "Unavailable"}
      </div>
    );
  }

  return (
    <Image
      src={resolvedSource}
      alt={alt}
      width={Math.max(1, Math.round(size.width))}
      height={Math.max(1, Math.round(size.height))}
      className="h-full w-full object-cover"
      unoptimized={resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:")}
      style={{ transform: "translateZ(0)" }}
    />
  );
}
