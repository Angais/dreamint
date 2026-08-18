import { NextRequest } from "next/server";

export const runtime = "nodejs";

type InputReference = {
  url?: string;
};

type ImageGenerationRequest = {
  apiKey?: string;
  model?: string;
  prompt?: string;
  numImages?: number;
  aspectRatio?: string | null;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
  inputImages?: InputReference[];
  providerTag?: string | null;
  allowFallbacks?: boolean;
};

const MODEL_ID_PATTERN = /^[\w.\-]+\/[\w.\-:]+$/;
const PROVIDER_TAG_PATTERN = /^[\w.\-]+(\/[\w.\-]+)?$/;

export async function POST(request: NextRequest) {
  let payload: ImageGenerationRequest;
  try {
    payload = (await request.json()) as ImageGenerationRequest;
  } catch {
    return Response.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const apiKey = (payload.apiKey ?? "").trim();
  if (!apiKey) {
    return Response.json({ error: { message: "Missing OpenRouter API key." } }, { status: 400 });
  }

  const prompt = (payload.prompt ?? "").trim();
  if (!prompt) {
    return Response.json({ error: { message: "Prompt is required." } }, { status: 400 });
  }

  const model = (payload.model ?? "").trim();
  if (!MODEL_ID_PATTERN.test(model)) {
    return Response.json({ error: { message: "A valid model id is required." } }, { status: 400 });
  }

  const numImages = Math.max(1, Math.min(10, Math.round(payload.numImages ?? 1)));
  const inputReferences = (Array.isArray(payload.inputImages) ? payload.inputImages : [])
    .map((image) => (typeof image?.url === "string" ? image.url.trim() : ""))
    .filter((url) => url.length > 0);

  const providerTag = (payload.providerTag ?? "").trim();
  if (providerTag && !PROVIDER_TAG_PATTERN.test(providerTag)) {
    return Response.json({ error: { message: "Invalid provider tag." } }, { status: 400 });
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: numImages,
  };

  if (payload.aspectRatio) {
    body.aspect_ratio = payload.aspectRatio;
  }
  if (payload.resolution) {
    body.resolution = payload.resolution;
  }
  if (payload.quality) {
    body.quality = payload.quality;
  }
  if (payload.outputFormat) {
    body.output_format = payload.outputFormat;
  }
  if (inputReferences.length > 0) {
    body.input_references = inputReferences.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));
  }
  if (providerTag) {
    // "only" + no fallbacks hard-pins the request (e.g. to a BYOK endpoint);
    // with fallbacks enabled the pinned provider is only tried first.
    body.provider = payload.allowFallbacks
      ? { order: [providerTag] }
      : { only: [providerTag], allow_fallbacks: false };
  }

  const upstreamResponse = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://dreamint.app",
      "X-Title": "Dreamint",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const responseText = await upstreamResponse.text();
  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });
}
