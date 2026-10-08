import { NextRequest } from "next/server";
import { buildImageRequest } from "../../../lib/image-request";
import type { Background, SupportedParameters } from "../../../lib/openrouter";

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
  background?: Background | null;
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

  if (!Number.isFinite(numImages)) {
    return Response.json({ error: { message: "Invalid image count." } }, { status: 400 });
  }
  if (payload.background && !["auto", "transparent", "opaque"].includes(payload.background)) {
    return Response.json({ error: { message: "Invalid background." } }, { status: 400 });
  }

  try {
    const metadataResponse = await fetch(
      `https://openrouter.ai/api/v1/images/models/${model}/endpoints`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(15_000) },
    );
    if (!metadataResponse.ok) {
      return Response.json({ error: { message: `Unable to check model capabilities (${metadataResponse.status}).` } }, { status: 502 });
    }
    const metadata = await metadataResponse.json() as {
      endpoints?: Array<{ provider_tag: string | null; supported_parameters: SupportedParameters }>;
    };
    const endpoints = metadata.endpoints ?? [];
    const candidates = providerTag
      ? endpoints.filter((endpoint) => endpoint.provider_tag === providerTag)
      : endpoints;
    // Choose capabilities that accept this request; never silently remove an
    // explicit transparency request or reference images to get it through.
    let body: Record<string, unknown> | undefined;
    let capabilityError = "No endpoint is available for the selected model and provider.";
    for (const endpoint of candidates) {
      try {
        body = buildImageRequest({
          model, prompt, numImages,
          aspectRatio: payload.aspectRatio,
          resolution: payload.resolution,
          quality: payload.quality,
          outputFormat: payload.outputFormat,
          background: payload.background,
          inputReferences,
        }, endpoint.supported_parameters);
        break;
      } catch (error) {
        capabilityError = error instanceof Error ? error.message : capabilityError;
      }
    }
    if (!body) {
      return Response.json({ error: { message: capabilityError } }, { status: 400 });
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
      signal: AbortSignal.timeout(470_000),
    });

    const responseText = await upstreamResponse.text();
    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json({ error: { message: timedOut
      ? "Image generation timed out. Check OpenRouter activity before retrying."
      : "Unable to reach OpenRouter. Please try again when the connection is restored." } },
      { status: timedOut ? 504 : 502 });
  }
}
