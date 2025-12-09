"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "./icons";
import type { Generation } from "./types";
import { useInfiniteScroll } from "./use-infinite-scroll";

type GalleryViewProps = {
  generations: Generation[];
  onExpand: (generationId: string, imageIndex: number) => void;
};

export function GalleryView({ generations, onExpand }: GalleryViewProps) {
  const [search, setSearch] = useState("");
  const { limit, loadMoreRef } = useInfiniteScroll({
    initialLimit: 20,
    increment: 20,
  });

  // Flatten all images into a single list for the grid
  const allImages = useMemo(() => {
    return generations.flatMap((gen) =>
      gen.images.map((src, index) => ({
        id: gen.id,
        index,
        src,
        prompt: gen.prompt,
        aspect: gen.aspect,
        createdAt: gen.createdAt,
      }))
    );
  }, [generations]);

  // Filter based on search
  const filteredImages = useMemo(() => {
    if (!search.trim()) return allImages;
    const lowerSearch = search.toLowerCase();
    return allImages.filter((img) => img.prompt.toLowerCase().includes(lowerSearch));
  }, [allImages, search]);

  const visibleImages = useMemo(() => filteredImages.slice(0, limit), [filteredImages, limit]);

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

      {/* Grid */}
      {visibleImages.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
            {visibleImages.map((item) => (
              <button
                key={`${item.id}-${item.index}`}
                type="button"
                onClick={() => onExpand(item.id, item.index)}
                className="group relative aspect-square w-full overflow-hidden bg-[var(--bg-subtle)] focus:outline-none"
              >
                <Image
                  src={item.src}
                  alt={item.prompt}
                  width={512}
                  height={512}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
              </button>
            ))}
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
