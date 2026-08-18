"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";

import { CopyIcon, DownloadIcon, MinusIcon, PlusIcon } from "./icons";
import { useResolvedImageSource } from "./use-resolved-image-source";

type AttachmentLightboxProps = {
  attachment: {
    url: string;
    name: string;
    id?: string;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
    fileSize?: number | null;
  };
  onClose: () => void;
};

function formatAttachmentDimensions(attachment: AttachmentLightboxProps["attachment"]): string | null {
  if (!attachment.width || !attachment.height) {
    return null;
  }

  return `${Math.round(attachment.width)}x${Math.round(attachment.height)}`;
}

function formatAttachmentType(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }

  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim();
  return subtype ? subtype.replace("jpeg", "jpg").toUpperCase() : null;
}

function formatAttachmentFileSize(fileSize: number | null | undefined): string | null {
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return null;
  }

  if (fileSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(fileSize < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function AttachmentLightbox({ attachment, onClose }: AttachmentLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const metadataCopyTimeoutRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [metadataCopyState, setMetadataCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const { resolvedSource, isResolving } = useResolvedImageSource(attachment.url);
  const zoomPercent = Math.round(transform.scale * 100);
  const metadataItems = [
    formatAttachmentDimensions(attachment),
    formatAttachmentType(attachment.mimeType),
    formatAttachmentFileSize(attachment.fileSize),
  ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    containerRef.current?.focus();
    setTransform({ x: 0, y: 0, scale: 1 });
    setMetadataCopyState("idle");
  }, [attachment.url]);

  useEffect(() => {
    return () => {
      if (metadataCopyTimeoutRef.current !== null) {
        window.clearTimeout(metadataCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleDownload = async () => {
    try {
      if (!resolvedSource) {
        throw new Error("Attachment is not ready.");
      }

      setIsDownloading(true);
      const response = await fetch(resolvedSource);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = attachment.name || `dreamint-input-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Unable to download attachment", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("Legacy clipboard copy failed");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const buildAttachmentMetadataJson = () =>
    JSON.stringify(
      {
        copiedAt: new Date().toISOString(),
        id: attachment.id ?? null,
        name: attachment.name,
        dimensions:
          attachment.width && attachment.height
            ? {
                width: Math.round(attachment.width),
                height: Math.round(attachment.height),
              }
            : null,
        mimeType: attachment.mimeType ?? null,
        fileType: formatAttachmentType(attachment.mimeType),
        fileSizeBytes: attachment.fileSize ?? null,
        fileSize: formatAttachmentFileSize(attachment.fileSize),
      },
      null,
      2,
    );

  const handleCopyMetadata = async () => {
    if (metadataCopyTimeoutRef.current !== null) {
      window.clearTimeout(metadataCopyTimeoutRef.current);
    }

    try {
      await copyText(buildAttachmentMetadataJson());
      setMetadataCopyState("copied");
    } catch (error) {
      console.error("Unable to copy attachment metadata", error);
      setMetadataCopyState("failed");
    }

    metadataCopyTimeoutRef.current = window.setTimeout(() => {
      setMetadataCopyState("idle");
      metadataCopyTimeoutRef.current = null;
    }, 1800);
  };

  const clampTransform = (scale: number, x: number, y: number) => {
    if (!imageContainerRef.current) {
      return { x, y, scale };
    }

    const { width, height } = imageContainerRef.current.getBoundingClientRect();
    const limitX = Math.max(0, (width * scale - width) / 2);
    const limitY = Math.max(0, (height * scale - height) / 2);

    return {
      x: Math.max(-limitX, Math.min(limitX, x)),
      y: Math.max(-limitY, Math.min(limitY, y)),
      scale,
    };
  };

  const handleZoomIn = () => {
    setTransform((previous) =>
      clampTransform(Math.min(previous.scale * 1.25, 8), previous.x, previous.y),
    );
  };

  const handleZoomOut = () => {
    setTransform((previous) =>
      clampTransform(Math.max(previous.scale / 1.25, 0.5), previous.x, previous.y),
    );
  };

  const handleResetZoom = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const scaleAmount = -event.deltaY * 0.001;
    setTransform((previous) =>
      clampTransform(
        Math.min(Math.max(0.5, previous.scale * (1 + scaleAmount)), 8),
        previous.x,
        previous.y,
      ),
    );
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0 || transform.scale <= 1) {
      return;
    }

    event.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: event.clientX - transform.x, y: event.clientY - transform.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging.current) {
      return;
    }

    event.preventDefault();
    setTransform((previous) =>
      clampTransform(previous.scale, event.clientX - dragStart.current.x, event.clientY - dragStart.current.y),
    );
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 py-8 outline-none animate-in fade-in duration-200"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        aria-label="Close attachment"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-sm text-[var(--text-secondary)]">
          <div
            ref={imageContainerRef}
            className={`relative flex max-h-[70vh] w-full justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/50 ${
              transform.scale > 1 ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {resolvedSource ? (
              <Image
                src={resolvedSource}
                alt={attachment.name}
                width={attachment.width ?? 1024}
                height={attachment.height ?? 1024}
                unoptimized
                className="max-h-[70vh] w-auto max-w-full select-none object-contain"
                draggable={false}
                style={{
                  transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                  transformOrigin: "center",
                }}
              />
            ) : (
              <div className="flex min-h-64 w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-white/60">
                {isResolving ? "Loading" : "Unavailable"}
              </div>
            )}
            {resolvedSource ? (
              <div
                className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 p-1 text-white shadow-lg backdrop-blur-md"
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={transform.scale <= 0.5}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/80"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  disabled={transform.scale === 1 && transform.x === 0 && transform.y === 0}
                  className="h-8 min-w-11 rounded-full px-2 text-xs font-bold tabular-nums text-white/80 transition hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white/80"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                >
                  {zoomPercent}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={transform.scale >= 8}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/80"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                {attachment.name}
              </p>
              {metadataItems.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {metadataItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyMetadata}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2 text-sm font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--border-highlight)] hover:text-white"
              >
                <CopyIcon className="h-4 w-4" />
                {metadataCopyState === "copied"
                  ? "Copied"
                  : metadataCopyState === "failed"
                    ? "Failed"
                    : "Copy Metadata"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-bold text-black shadow-lg shadow-sky-900/20 transition-all hover:bg-sky-400 hover:shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <span className="h-4 w-4 animate-spin border-2 border-white/60 border-t-transparent rounded-full" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                {isDownloading ? "Downloading..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
