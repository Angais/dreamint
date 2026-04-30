"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { useResolvedImageSource } from "./use-resolved-image-source";

type CompareSliderProps = {
  original: string;
  generated: string;
  originalAlt?: string;
  generatedAlt?: string;
  position: number;
  onPositionChange: (position: number) => void;
  isPannable?: boolean;
};

export function CompareSlider({
  original,
  generated,
  originalAlt = "Original image",
  generatedAlt = "Generated image",
  position,
  onPositionChange,
  isPannable = false,
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const { resolvedSource: resolvedOriginal, isResolving: isResolvingOriginal } =
    useResolvedImageSource(original);
  const { resolvedSource: resolvedGenerated, isResolving: isResolvingGenerated } =
    useResolvedImageSource(generated);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    onPositionChange(percentage);
  }, [onPositionChange]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
        return;
    }
    isDragging.current = true;
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length > 1) {
        return;
    }

    if (isPannable) {
        const target = event.target as Node;
        const isHandle = handleRef.current && (handleRef.current === target || handleRef.current.contains(target));
        
        if (isHandle) {
             isDragging.current = true;
             event.stopPropagation();
        }
    } else {
        isDragging.current = true;
        event.stopPropagation();
    }
  }, [isPannable]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length > 1 || !isDragging.current) return;
      handleMove(event.touches[0].clientX);
    },
    [handleMove],
  );

  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging.current) {
        handleMove(event.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleMove]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-ew-resize select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Generated Image (Right side / Background) */}
      <div className="absolute inset-0 h-full w-full">
        {resolvedGenerated ? (
          <Image
            src={resolvedGenerated}
            alt={generatedAlt}
            fill
            className="object-contain"
            draggable={false}
            priority
            unoptimized={resolvedGenerated.startsWith("blob:") || resolvedGenerated.startsWith("data:")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-white/60">
            {isResolvingGenerated ? "Loading" : "Unavailable"}
          </div>
        )}
        <div className="absolute bottom-4 right-4 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          After
        </div>
      </div>

      {/* Original Image (Left side / Foreground - Clipped) */}
      <div
        className="absolute inset-0 h-full w-full"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {resolvedOriginal ? (
          <Image
            src={resolvedOriginal}
            alt={originalAlt}
            fill
            className="object-contain"
            draggable={false}
            priority
            unoptimized={resolvedOriginal.startsWith("blob:") || resolvedOriginal.startsWith("data:")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-white/60">
            {isResolvingOriginal ? "Loading" : "Unavailable"}
          </div>
        )}
        <div className="absolute bottom-4 left-4 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          Before
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${position}%` }}
      >
        <div
            ref={handleRef}
            className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg"
        >
          <div className="flex gap-0.5 text-black">
            <ArrowLeftIcon className="h-3 w-3" />
            <ArrowRightIcon className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
