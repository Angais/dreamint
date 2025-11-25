"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { DownloadIcon } from "./icons";

type AttachmentLightboxProps = {
  attachment: { url: string; name: string; id?: string; width?: number | null; height?: number | null };
  onClose: () => void;
};

export function AttachmentLightbox({ attachment, onClose }: AttachmentLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    containerRef.current?.focus();
  }, [attachment.url]);

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
      setIsDownloading(true);
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = attachment.name || `nano-banana-input-${Date.now()}.png`;
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
          <div className="relative flex max-h-[70vh] w-full justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/50">
            <Image
              src={attachment.url}
              alt={attachment.name}
              width={attachment.width ?? 1024}
              height={attachment.height ?? 1024}
              unoptimized
              className="max-h-[70vh] w-auto max-w-full select-none object-contain"
              draggable={false}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--text-primary)]">{attachment.name}</p>
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
  );
}