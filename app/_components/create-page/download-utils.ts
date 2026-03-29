"use client";

import type { OutputFormat } from "../../lib/seedream-options";

export function extensionFromMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }

  const normalized = mimeType.toLowerCase();

  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  return null;
}

export function mimeTypeFromOutputFormat(format: OutputFormat): string {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  if (format === "webp") {
    return "image/webp";
  }

  return "image/png";
}

export async function convertBlobToOutputFormat(blob: Blob, format: OutputFormat): Promise<Blob> {
  const targetMimeType = mimeTypeFromOutputFormat(format);
  const sourceMimeType = blob.type.toLowerCase();

  if (sourceMimeType === targetMimeType) {
    return blob;
  }

  if (!sourceMimeType.startsWith("image/") || typeof document === "undefined") {
    return blob;
  }

  let cleanup = () => {};

  try {
    let source: CanvasImageSource;
    let width = 0;
    let height = 0;

    if (typeof window !== "undefined" && "createImageBitmap" in window) {
      const bitmap = await createImageBitmap(blob);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
      cleanup = () => bitmap.close();
    } else {
      const objectUrl = URL.createObjectURL(blob);
      cleanup = () => URL.revokeObjectURL(objectUrl);

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.decoding = "async";
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Unable to decode image for conversion."));
        nextImage.src = objectUrl;
      });

      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    }

    if (!width || !height) {
      cleanup();
      return blob;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return blob;
    }

    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(source, 0, 0, width, height);

    const convertedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetMimeType, format === "jpeg" ? 0.92 : undefined),
    );

    cleanup();
    return convertedBlob ?? blob;
  } catch (error) {
    cleanup();
    console.error("Unable to convert downloaded image", error);
    return blob;
  }
}
