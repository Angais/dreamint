import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";

import { getAspectDescription, getQualityLabel } from "../../lib/seedream-options";
import { CompareSlider } from "./compare-slider";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, DownloadIcon, InfoIcon, PlusIcon, SpinnerIcon, XIcon } from "./icons";
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
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState(0);
  const [compareSliderPosition, setCompareSliderPosition] = useState(50);
  const [isDownloadingComparison, setIsDownloadingComparison] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Touch handling state
  const touchRef = useRef({
    lastDist: 0,
    startPan: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false,
  });

  const hasReferences = entry.inputImages && entry.inputImages.length > 0;

  useEffect(() => {
    setIsCompareMode(false);
    setSelectedReferenceIndex(0);
    setCompareSliderPosition(50);
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [entry.generationId, entry.imageIndex]);

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
    event.stopPropagation();
    const scaleAmount = -event.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, transform.scale * (1 + scaleAmount)), 8);
    
    setTransform((prev) => ({
      ...prev,
      scale: newScale,
    }));
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const isLeft = event.button === 0;
    const isRight = event.button === 2;

    // In compare mode, only allow pan with right click (button 2)
    // In normal mode, allow pan with left click (button 0)
    if (isCompareMode) {
      if (!isRight) return;
    } else {
      if (!isLeft) return;
    }

    event.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: event.clientX - transform.x, y: event.clientY - transform.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging.current) return;
    event.preventDefault();

    const nextX = event.clientX - dragStart.current.x;
    const nextY = event.clientY - dragStart.current.y;

    if (imageContainerRef.current) {
      const { width: viewportWidth, height: viewportHeight } = imageContainerRef.current.getBoundingClientRect();
      
      const effectiveImageWidth = viewportWidth * transform.scale;
      const effectiveImageHeight = viewportHeight * transform.scale;

      const limitX = Math.max(0, (effectiveImageWidth - viewportWidth) / 2);
      const limitY = Math.max(0, (effectiveImageHeight - viewportHeight) / 2);
      
      const clampedX = Math.max(-limitX, Math.min(limitX, nextX));
      const clampedY = Math.max(-limitY, Math.min(limitY, nextY));
      
      setTransform((prev) => ({
        ...prev,
        x: clampedX,
        y: clampedY,
      }));
    } else {
      setTransform((prev) => ({
        ...prev,
        x: nextX,
        y: nextY,
      }));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      // Single touch - start panning
      touchRef.current.isPanning = true;
      touchRef.current.isPinching = false;
      touchRef.current.startPan = {
        x: event.touches[0].clientX - transform.x,
        y: event.touches[0].clientY - transform.y,
      };
    } else if (event.touches.length === 2) {
      // Two fingers - start pinching
      touchRef.current.isPinching = true;
      touchRef.current.isPanning = false;
      touchRef.current.lastDist = getDistance(event.touches);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault(); // Prevent scrolling

    if (touchRef.current.isPinching && event.touches.length === 2) {
      const dist = getDistance(event.touches);
      const scaleChange = dist / touchRef.current.lastDist;
      const newScale = Math.min(Math.max(0.5, transform.scale * scaleChange), 8); // Limits: 0.5x to 8x

      setTransform((prev) => ({
        ...prev,
        scale: newScale,
      }));
      
      touchRef.current.lastDist = dist;
    } else if (touchRef.current.isPanning && event.touches.length === 1) {
       // Only allow panning if not in compare mode (slider needs touch) or handle appropriately
       // Actually, compare slider usually handles its own touch if we don't preventDefault.
       // But we called preventDefault above.
       // If compare mode is active, the slider component needs the touch events.
       // So we should maybe not preventDefault if target is slider? 
       // For now, let's assume panning image is desired unless strictly on the slider knob.
       
       // NOTE: If isCompareMode is true, we might want to disable image panning 
       // to let the user use the slider? 
       // Or we treat single touch as pan, and require slider interaction to be specific?
       // The slider component likely uses mouse/touch listeners.
       // Let's allow panning if isCompareMode is false.

       const nextX = event.touches[0].clientX - touchRef.current.startPan.x;
       const nextY = event.touches[0].clientY - touchRef.current.startPan.y;
       
       if (imageContainerRef.current) {
        const { width: viewportWidth, height: viewportHeight } = imageContainerRef.current.getBoundingClientRect();
        
        const effectiveImageWidth = viewportWidth * transform.scale;
        const effectiveImageHeight = viewportHeight * transform.scale;
  
        const limitX = Math.max(0, (effectiveImageWidth - viewportWidth) / 2);
        const limitY = Math.max(0, (effectiveImageHeight - viewportHeight) / 2);
        
        const clampedX = Math.max(-limitX, Math.min(limitX, nextX));
        const clampedY = Math.max(-limitY, Math.min(limitY, nextY));
        
        setTransform((prev) => ({
          ...prev,
          x: clampedX,
          y: clampedY,
        }));
      }
    }
  };

  const handleTouchEnd = () => {
    touchRef.current.isPanning = false;
    touchRef.current.isPinching = false;
  };

  const handleDownloadComparison = async () => {
    if (!hasReferences || !isCompareMode) return;
    setIsDownloadingComparison(true);

    try {
      const originalUrl = entry.inputImages[selectedReferenceIndex].url;
      const generatedUrl = entry.src;
      const width = entry.size.width;
      const height = entry.size.height;

      const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

      const [imgOriginal, imgGenerated] = await Promise.all([
        loadImage(originalUrl),
        loadImage(generatedUrl)
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No canvas context");

      // 1. Draw Generated (Background) - Full
      ctx.drawImage(imgGenerated, 0, 0, width, height);

      // 2. Draw Original (Foreground) - Clipped
      const splitX = (compareSliderPosition / 100) * width;
      
      ctx.save();
      ctx.beginPath();
      // Clip left side to show Original
      ctx.rect(0, 0, splitX, height);
      ctx.clip();
      
      ctx.drawImage(imgOriginal, 0, 0, width, height);
      ctx.restore();

      // 3. Draw the white line
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = Math.max(2, width * 0.002); 
      ctx.stroke();
      
      // 4. Convert to Blob and Download
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error("Canvas to Blob failed");
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparison-${entry.generationId.slice(0,8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Failed to download comparison", e);
    } finally {
      setIsDownloadingComparison(false);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/95 backdrop-blur-sm p-0 md:px-4 md:py-8 outline-none animate-in fade-in duration-200"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        aria-label="Close image"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-6xl h-full md:h-auto md:max-h-[90vh] rounded-none md:rounded-2xl border-0 md:border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-0 md:p-2 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden">
        
        {/* Image Container */}
        <div 
          ref={imageContainerRef}
          className="relative flex-1 bg-black/50 md:rounded-xl overflow-hidden flex items-center justify-center min-h-0 md:min-h-[70vh]"
          style={{ touchAction: "none" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
            {canGoPrev ? (
              <button
                type="button"
                aria-label="Previous image"
                className="group absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white backdrop-blur transition hover:bg-white hover:text-black hover:shadow-lg focus:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrev();
                }}
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            ) : null}
            
            <div 
              style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                cursor: isCompareMode ? 'default' : 'grab'
              }}
              className="relative flex h-full w-full items-center justify-center transition-transform duration-75 ease-out"
            >
              {isCompareMode && hasReferences ? (
                <div className="relative h-full w-full">
                  <CompareSlider
                    original={entry.inputImages[selectedReferenceIndex].url}
                    generated={entry.src}
                    originalAlt="Reference image"
                    generatedAlt={entry.prompt}
                    position={compareSliderPosition}
                    onPositionChange={setCompareSliderPosition}
                    isPannable={transform.scale > 1}
                  />
                </div>
              ) : (
                <Image
                  src={entry.src}
                  alt={entry.prompt}
                  width={entry.size.width}
                  height={entry.size.height}
                  className="max-h-full w-auto max-w-full select-none object-contain shadow-lg"
                  draggable={false}
                  priority
                />
              )}
            </div>
            
            {canGoNext ? (
              <button
                type="button"
                aria-label="Next image"
                className="group absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white backdrop-blur transition hover:bg-white hover:text-black hover:shadow-lg focus:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
              >
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            ) : null}

            {/* Mobile Close Button (when details hidden) */}
            {!showDetails && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 z-30 rounded-full bg-black/70 p-3 text-white backdrop-blur-md shadow-lg border border-white/10 transition hover:bg-white hover:text-black md:hidden"
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}

            {/* Mobile Show Details Trigger */}
            {!showDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="absolute bottom-4 right-4 z-30 rounded-full bg-black/70 p-3 text-white backdrop-blur-md shadow-lg border border-white/10 transition hover:bg-white hover:text-black md:hidden"
                aria-label="Show details"
              >
                <InfoIcon className="h-5 w-5" />
              </button>
            )}
        </div>

        {/* Sidebar for Details */}
        <div className={`${showDetails ? "flex" : "hidden"} md:flex absolute bottom-0 left-0 right-0 z-20 md:static md:z-auto w-full md:w-[320px] bg-[var(--bg-panel)] p-4 md:p-6 flex-col border-t md:border-t-0 md:border-l border-[var(--border-subtle)] max-h-[50vh] md:max-h-full shadow-2xl md:shadow-none`}>
           <div className="flex justify-between items-center mb-3 md:mb-6">
             <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="md:hidden rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-white transition-colors"
                  aria-label="Hide details"
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </button>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Details</h2>
             </div>
              <button
                type="button"
                className="rounded-full p-2 -mr-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)] transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                 <XIcon className="h-5 w-5" />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto pr-2">
             <p className="text-sm leading-relaxed text-[var(--text-primary)] font-medium mb-4 max-h-32 overflow-y-auto">
               {entry.prompt}
             </p>
             
             <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-secondary)] mb-3 md:mb-6">
                <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-1">Aspect</span>
                  {getAspectDescription(entry.aspect)}
                </div>
                <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-1">Quality</span>
                  {getQualityLabel(entry.quality)}
                </div>
             </div>
           </div>

           <div className="mt-auto pt-3 md:pt-6 border-t border-[var(--border-subtle)] space-y-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={onDownload}
                disabled={isDownloading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-3 text-sm font-bold text-black shadow-lg shadow-sky-900/20 transition-all hover:bg-gray-200 hover:shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
                {isDownloading ? "Saving..." : "Download Image"}
              </button>

              {isCompareMode && hasReferences && (
                  <button
                    type="button"
                    onClick={handleDownloadComparison}
                    disabled={isDownloadingComparison}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[var(--bg-input)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloadingComparison ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
                    {isDownloadingComparison ? "Saving..." : "Save Comparison"}
                  </button>
              )}

              {hasReferences ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCompareMode(!isCompareMode)}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-3 text-sm font-semibold transition-colors hover:text-white hover:border-[var(--text-muted)] ${
                      isCompareMode
                        ? "bg-[var(--bg-subtle)] text-white border-[var(--text-muted)]"
                        : "bg-[var(--bg-input)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <span className="text-lg leading-none">⇄</span>
                    {isCompareMode ? "Exit Compare" : "Compare"}
                  </button>

                  {isCompareMode && entry.inputImages.length > 1 ? (
                    <div className="grid grid-cols-4 gap-2 rounded-lg bg-[var(--bg-subtle)] p-2">
                      {entry.inputImages.map((img, idx) => (
                        <button
                          type="button"
                          key={img.id || idx}
                          onClick={() => setSelectedReferenceIndex(idx)}
                          className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                            selectedReferenceIndex === idx
                              ? "border-[var(--accent-primary)] opacity-100"
                              : "border-transparent opacity-50 hover:opacity-100"
                          }`}
                          title={img.name}
                        >
                          <Image src={img.url} alt={img.name} fill className="object-cover" sizes="60px" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              
              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-white hover:border-[var(--text-muted)]"
                >
                  <PlusIcon className="h-4 w-4" />
                  Use as Reference
                </button>
              ) : null}
           </div>
        </div>
      </div>
    </div>
  );
}