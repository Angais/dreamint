"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";

type CompareSliderProps = {
  original: string;
  generated: string;
  originalAlt?: string;
  generatedAlt?: string;
};

export function CompareSlider({
  original,
  generated,
  originalAlt = "Original image",
  generatedAlt = "Generated image",
}: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setPosition(percentage);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ('button' in event && event.button !== 0) {
        return;
    }
    isDragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
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
      onTouchStart={handleMouseDown}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Generated Image (Right side / Background) */}
      <div className="absolute inset-0 h-full w-full">
        <Image
          src={generated}
          alt={generatedAlt}
          fill
          className="object-contain"
          draggable={false}
          priority
        />
        <div className="absolute bottom-4 right-4 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          After
        </div>
      </div>

      {/* Original Image (Left side / Foreground - Clipped) */}
      <div
        className="absolute inset-0 h-full w-full"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src={original}
          alt={originalAlt}
          fill
          className="object-contain"
          draggable={false}
          priority
        />
        <div className="absolute bottom-4 left-4 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          Before
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${position}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          <div className="flex gap-0.5 text-black">
            <ArrowLeftIcon className="h-3 w-3" />
            <ArrowRightIcon className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
