type CollageLayout = { cols: number; rows: number };

function resolveLayout(count: number): CollageLayout {
  if (count <= 1) {
    return { cols: 1, rows: 1 };
  }
  if (count === 2) {
    return { cols: 2, rows: 1 };
  }
  return { cols: 2, rows: 2 };
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const safeSourceWidth = Math.max(1, Math.round(sourceWidth));
  const safeSourceHeight = Math.max(1, Math.round(sourceHeight));
  const safeDw = Math.max(1, Math.round(dw));
  const safeDh = Math.max(1, Math.round(dh));

  const scale = Math.min(safeDw / safeSourceWidth, safeDh / safeSourceHeight);
  const targetWidth = Math.max(1, Math.round(safeSourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(safeSourceHeight * scale));
  const x = dx + Math.round((safeDw - targetWidth) / 2);
  const y = dy + Math.round((safeDh - targetHeight) / 2);

  ctx.drawImage(source, x, y, targetWidth, targetHeight);
}

async function decodeImage(url: string): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
} | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    if (typeof window !== "undefined" && "createImageBitmap" in window) {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);
      image.decoding = "async";
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to decode image"));
      };
      image.src = objectUrl;
    });

    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

export async function createCollageBlob(
  urls: string[],
  {
    tileSize = 1024,
    tileDimensions,
    background = "#000000",
    mimeType = "image/png",
  }: {
    tileSize?: number;
    tileDimensions?: { width: number; height: number };
    background?: string;
    mimeType?: "image/png" | "image/jpeg";
  } = {},
): Promise<Blob | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const uniqueUrls = Array.from(new Set(urls.filter((url) => url && url.trim().length > 0))).slice(0, 4);
  if (uniqueUrls.length === 0) {
    return null;
  }

  const layout = resolveLayout(uniqueUrls.length);
  const safeTileSize = Math.max(256, Math.round(tileSize));
  const safeTileWidth = Math.max(
    256,
    Math.round(tileDimensions?.width ?? safeTileSize),
  );
  const safeTileHeight = Math.max(
    256,
    Math.round(tileDimensions?.height ?? safeTileSize),
  );

  const canvas = document.createElement("canvas");
  canvas.width = layout.cols * safeTileWidth;
  canvas.height = layout.rows * safeTileHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const decoded = await Promise.all(uniqueUrls.map((url) => decodeImage(url)));

  for (let index = 0; index < decoded.length; index += 1) {
    const decodedImage = decoded[index];
    if (!decodedImage) {
      continue;
    }

    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    const dx = col * safeTileWidth;
    const dy = row * safeTileHeight;

    drawContain(
      ctx,
      decodedImage.source,
      decodedImage.width,
      decodedImage.height,
      dx,
      dy,
      safeTileWidth,
      safeTileHeight,
    );
    decodedImage.cleanup?.();
  }

  return await new Promise<Blob | null>((resolve) => {
    const quality = mimeType === "image/jpeg" ? 0.92 : undefined;
    canvas.toBlob(resolve, mimeType, quality);
  });
}
