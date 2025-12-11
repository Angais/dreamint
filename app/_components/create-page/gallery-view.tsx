"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { MagnifyingGlassIcon } from "./icons";
import type { Generation } from "./types";
import { useInfiniteScroll } from "./use-infinite-scroll";

type GalleryViewProps = {
  generations: Generation[];
  onExpand: (generationId: string, imageIndex: number) => void;
  onDeleteImages: (items: Array<{ generationId: string; imageIndex: number }>) => void;
};

export function GalleryView({ generations, onExpand, onDeleteImages }: GalleryViewProps) {
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const { limit, loadMoreRef } = useInfiniteScroll({
    initialLimit: 20,
    increment: 20,
  });

  // Flatten all images into a single list for the grid
  const allImages = useMemo(() => {
    return generations.flatMap((gen) => {
      const deletedSet = new Set(gen.deletedImages ?? []);
      return gen.images
        .map((src, index) => {
          const fullSrc = src;
          const thumbSrc = gen.thumbnails?.[index] || fullSrc;

          return {
            id: gen.id,
            index,
            src: thumbSrc,
            fullSrc,
            prompt: gen.prompt,
            aspect: gen.aspect,
            createdAt: gen.createdAt,
            deleted: deletedSet.has(index),
          };
        })
        .filter((img) => Boolean(img.fullSrc) && !img.deleted);
    });
  }, [generations]);

  // Filter based on search
  const filteredImages = useMemo(() => {
    if (!search.trim()) return allImages;
    const lowerSearch = search.toLowerCase();
    return allImages.filter((img) => img.prompt.toLowerCase().includes(lowerSearch));
  }, [allImages, search]);

  const visibleImages = useMemo(() => filteredImages.slice(0, limit), [filteredImages, limit]);
  const imageByKey = useMemo(() => {
    const map = new Map<string, (typeof allImages)[number]>();
    allImages.forEach((img) => {
      map.set(`${img.id}:${img.index}`, img);
    });
    return map;
  }, [allImages]);

  const selectedItems = useMemo(() => {
    const items: (typeof allImages)[number][] = [];
    selectedKeys.forEach((key) => {
      const item = imageByKey.get(key);
      if (item) {
        items.push(item);
      }
    });
    return items;
  }, [imageByKey, selectedKeys]);

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
  };

  const clearSelection = () => setSelectedKeys(new Set());

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
      const mimeToExt = (mime: string) => {
        if (mime.includes("jpeg")) return "jpg";
        if (mime.includes("webp")) return "webp";
        return "png";
      };

      await Promise.all(
        selectedItems.map(async (item, i) => {
          try {
            const response = await fetch(item.fullSrc);
            if (!response.ok) return;
            const blob = await response.blob();
            const ext = mimeToExt(blob.type);
            const safeId = item.id.slice(0, 8);
            const filename = `dreamint-${safeId}-${item.index + 1}-${i + 1}.${ext}`;
            zip.file(filename, blob);
          } catch (error) {
            console.error("Failed to add image to zip", error);
          }
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dreamint-selection-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Search Bar */}
      <div className="relative max-w-md mx-auto w-full">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <MagnifyingGlassIcon className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your dreams..."
          className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] py-3 pl-11 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
        />
      </div>

      {/* Selection Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
        <button
          type="button"
          onClick={() => {
            setSelectionMode((prev) => !prev);
            clearSelection();
          }}
          className={`rounded-full border px-4 py-2 font-semibold transition-colors ${
            selectionMode
              ? "border-[var(--text-primary)] bg-[var(--bg-subtle)] text-white"
              : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-highlight)]"
          }`}
        >
          {selectionMode ? "Exit Select" : "Select"}
        </button>

        {selectedItems.length > 0 ? (
          <>
            <span className="px-2 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              {selectedItems.length} selected
            </span>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="rounded-full bg-[var(--accent-primary)] text-black px-4 py-2 font-semibold hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isZipping ? "Zipping..." : "Download ZIP"}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="rounded-full bg-red-950/40 text-red-200 border border-red-900/60 px-4 py-2 font-semibold hover:bg-red-900/60 hover:text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Clear
            </button>
          </>
        ) : null}
      </div>

      {/* Grid */}
      {visibleImages.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
            {visibleImages.map((item) => {
              const selectionKey = `${item.id}:${item.index}`;
              const isSelected = selectedKeys.has(selectionKey);

              return (
                <button
                  key={`${item.id}-${item.index}`}
                  type="button"
                  onClick={(event) => {
                    const isModifierSelect = event.ctrlKey || event.metaKey;
                    if (selectionMode || isModifierSelect) {
                      if (isModifierSelect && !selectionMode) {
                        setSelectionMode(true);
                      }
                      toggleSelected(item.id, item.index);
                      return;
                    }
                    onExpand(item.id, item.index);
                  }}
                  className="group relative aspect-square w-full overflow-hidden bg-[var(--bg-subtle)] focus:outline-none transform-gpu"
                >
                  <Image
                    src={item.src}
                    alt={item.prompt}
                    width={512}
                    height={512}
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                    unoptimized
                    style={{ willChange: "transform", transform: "translateZ(0)" }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />

                  {selectionMode ? (
                    <div className="pointer-events-none absolute right-2 top-2 z-10">
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-white border-white"
                            : "bg-black/40 border-white/60"
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
                  ) : null}
                </button>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="h-4 w-full" />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
          <p>No images found.</p>
        </div>
      )}
    </div>
  );
}
