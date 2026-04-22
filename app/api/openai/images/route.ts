import { NextRequest } from "next/server";

import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_QUALITY,
  OPENAI_CONCRETE_MODELS,
  type OpenAIModel,
  type OpenAIQuality,
  type OutputFormat,
} from "../../../lib/seedream-options";

export const runtime = "nodejs";

type InputImage = {
  id?: string;
  name?: string;
  url?: string;
};

type OpenAIImageRequest = {
  apiKey?: string;
  prompt?: string;
  model?: OpenAIModel;
  quality?: OpenAIQuality;
  outputFormat?: OutputFormat;
  numImages?: number;
  size?: { width: number; height: number };
  inputImages?: InputImage[];
};

const OPENAI_IMAGE_MODELS = new Set<OpenAIModel>(OPENAI_CONCRETE_MODELS);

function buildFilename(name: string | undefined, fallback: string, mimeType: string): string {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] ?? "png";
  return `${fallback}.${extension}`;
}

async function inputImageToFile(image: InputImage, index: number): Promise<File> {
  const rawUrl = typeof image.url === "string" ? image.url.trim() : "";
  if (!rawUrl) {
    throw new Error(`Input image ${index + 1} is missing a URL.`);
  }

  if (rawUrl.startsWith("data:")) {
    const [header, base64Data] = rawUrl.split(",", 2);
    const mimeType = header.match(/^data:(.*?);base64$/)?.[1] ?? "image/png";
    const buffer = Buffer.from(base64Data ?? "", "base64");
    return new File([buffer], buildFilename(image.name, `reference-${index + 1}`, mimeType), {
      type: mimeType,
    });
  }

  const response = await fetch(rawUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to fetch input image ${index + 1} (${response.status}).`);
  }

  const mimeType = response.headers.get("content-type") ?? "image/png";
  const arrayBuffer = await response.arrayBuffer();
  return new File([arrayBuffer], buildFilename(image.name, `reference-${index + 1}`, mimeType), {
    type: mimeType,
  });
}

async function proxyOpenAIRequest(request: OpenAIImageRequest) {
  const resolvedApiKey = (request.apiKey ?? "").trim();
  if (!resolvedApiKey) {
    return Response.json({ error: { message: "Missing OpenAI API key." } }, { status: 400 });
  }

  const prompt = (request.prompt ?? "").trim();
  if (!prompt) {
    return Response.json({ error: { message: "Prompt is required." } }, { status: 400 });
  }

  const model = request.model ?? DEFAULT_OPENAI_MODEL;
  if (!OPENAI_IMAGE_MODELS.has(model)) {
    return Response.json({ error: { message: "Unsupported OpenAI image model." } }, { status: 400 });
  }

  const quality = request.quality ?? DEFAULT_OPENAI_QUALITY;
  const width = Math.round(request.size?.width ?? 0);
  const height = Math.round(request.size?.height ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return Response.json({ error: { message: "A valid image size is required." } }, { status: 400 });
  }

  const size = `${width}x${height}`;
  const numImages = Math.max(1, Math.min(4, Math.round(request.numImages ?? 1)));
  const outputFormat = request.outputFormat ?? "png";
  const inputImages = Array.isArray(request.inputImages)
    ? request.inputImages.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
    : [];

  const endpoint =
    inputImages.length > 0
      ? "https://api.openai.com/v1/images/edits"
      : "https://api.openai.com/v1/images/generations";

  let upstreamResponse: Response;

  if (inputImages.length > 0) {
    const formData = new FormData();
    formData.append("model", model);
    formData.append("prompt", prompt);
    formData.append("size", size);
    formData.append("quality", quality);
    formData.append("n", String(numImages));
    formData.append("output_format", outputFormat);

    const files = await Promise.all(inputImages.map((image, index) => inputImageToFile(image, index)));
    for (const file of files) {
      formData.append("image[]", file, file.name);
    }

    upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
      },
      body: formData,
      cache: "no-store",
    });
  } else {
    upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        n: numImages,
        output_format: outputFormat,
      }),
      cache: "no-store",
    });
  }

  const responseText = await upstreamResponse.text();
  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as OpenAIImageRequest;
    return await proxyOpenAIRequest(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI image request failed.";
    return Response.json({ error: { message } }, { status: 500 });
  }
}
