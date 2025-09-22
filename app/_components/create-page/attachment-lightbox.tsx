"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { DownloadIcon } from "./icons";

type AttachmentLightboxProps = {
  attachment: { url: string; name: string; id?: string };
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
      link.download = attachment.name || `seedream-input-${Date.now()}.png`;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 outline-none"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        aria-label="Close attachment"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-[#1c1d27] bg-[#0f1017] p-6 shadow-[0_45px_120px_-50px_rgba(0,0,0,0.9)]">
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-full border border-[#2a2b36] bg-[#151620] px-3 py-1 text-xs font-semibold text-[#dcdde5] transition-colors hover:border-[#343545]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-4 text-sm text-[#cfd0da]">
          <div className="relative flex max-h-[70vh] w-full justify-center overflow-hidden rounded-2xl border border-[#181922] bg-black/30">
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
          <div className="flex flex-col gap-2">
            <p className="text-base font-medium text-white">{attachment.name}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 rounded-full border border-[#2a2b36] bg-[#151620] px-5 py-2.5 text-sm font-semibold text-[#dcdde5] transition-colors hover:border-[#343545] disabled:cursor-not-allowed disabled:border-[#2a2b36] disabled:text-[#77798a]"
              >
                {isDownloading ? (
                  <span className="h-4 w-4 animate-spin border border-[#dcdde5]/60 border-t-transparent rounded-full" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                {isDownloading ? "Preparing" : "Download"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
