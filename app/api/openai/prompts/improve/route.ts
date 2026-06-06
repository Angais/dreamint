import { NextRequest } from "next/server";

export const runtime = "nodejs";

type InputImage = {
  id?: string;
  name?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
};

type ImprovePromptRequest = {
  apiKey?: string;
  prompt?: string;
  imageIndex?: number;
  totalImages?: number;
  model?: string;
  quality?: string;
  size?: { width: number; height: number };
  inputImages?: InputImage[];
};

type OpenAIResponseContent = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponsePayload = {
  output?: OpenAIResponseOutput[];
  output_text?: string;
  error?: { message?: string };
};

const PROMPT_IMPROVER_MODEL = "gpt-5.5";
const PROMPT_IMPROVER_TIMEOUT_MS = 180_000;

const PROMPT_IMPROVER_SYSTEM_PROMPT = `
You are an expert prompt engineer for OpenAI gpt-image-2 image generation and editing.

Rewrite the user's prompt into one production-ready image prompt for the specific output variant requested. Preserve the user's core intent, subject, constraints, language, named entities, proper nouns, titles, brands, franchises, product names, and any explicit text that must appear in the image. Do not add brands, copyrighted characters, watermarks, signatures, logos, or unsafe details unless the user explicitly supplied them and they are allowed.

Hard preservation rules:
- Treat every explicit named entity or title in the original prompt as intentional. Keep it exact, including capitalization, unless the user asks to rename, translate, parody, avoid, or generalize it.
- Do not replace or soften explicit user terms with phrases like "inspired by", "in the style of", "reminiscent of", "similar to", "homage to", or generic category descriptions unless the original prompt already asked for that relationship.
- If the user writes a short prompt such as a game, brand, character, place, product, or franchise name, make that named thing the direct subject/context of the image prompt. Elaborate visual details around it without changing what it is.
- If a named entity is ambiguous, preserve the exact word and add visual detail without inventing a different interpretation.

Use the GPT Image 2 prompting guide principles:
- Make the prompt specific, concrete, and visually controllable.
- Structure the prompt as a design brief with the goal, subject, setting, composition, camera or layout, lighting, materials, color palette, mood, style, and constraints when relevant.
- For edits or reference images, clearly separate what should change from what must remain invariant. Restate identity, pose, layout, style, text, and other invariants that should not drift.
- For text in the image, quote the exact text to render and specify readable placement, contrast, and no extra text.
- For diagrams, UI, infographics, packaging, or other structured visuals, define audience, format, hierarchy, required labels, spacing, and clarity constraints.
- For photorealism, specify lens, perspective, lighting, material realism, depth of field, and scene details.
- For character or product consistency, describe the stable anchor details precisely.
- If several images are requested, make this variant distinct while keeping the same intent. Vary composition, angle, lighting, environment, palette, styling emphasis, or narrative beat in a useful way.

Return only the final improved prompt text. No markdown fences, no commentary, no labels outside the prompt.
`.trim();

function buildUserPrompt(request: ImprovePromptRequest) {
  const imageIndex = Math.max(0, Math.round(request.imageIndex ?? 0));
  const totalImages = Math.max(1, Math.round(request.totalImages ?? 1));
  const size = request.size;
  const referenceCount = Array.isArray(request.inputImages)
    ? request.inputImages.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0).length
    : 0;

  return [
    `Original prompt:\n${(request.prompt ?? "").trim()}`,
    `Variant: ${imageIndex + 1} of ${totalImages}.`,
    `Target image model: ${request.model ?? "gpt-image-2"}.`,
    `Target image quality: ${request.quality ?? "medium"}.`,
    size ? `Target size: ${Math.round(size.width)}x${Math.round(size.height)}.` : null,
    referenceCount > 0
      ? `Reference images are attached after this text in the exact upload order, as image 1 through image ${referenceCount}. Use that order when describing invariants or edits.`
      : "No reference images are attached.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputText = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => {
      if (content.type === "refusal" && content.refusal) {
        return content.refusal;
      }
      return content.type === "output_text" ? content.text ?? "" : "";
    })
    .join("")
    .trim();

  return outputText;
}

function stripMarkdownFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:text|markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ImprovePromptRequest;
    const resolvedApiKey = (payload.apiKey ?? "").trim();
    if (!resolvedApiKey) {
      return Response.json({ error: { message: "Missing OpenAI API key." } }, { status: 400 });
    }

    const prompt = (payload.prompt ?? "").trim();
    if (!prompt) {
      return Response.json({ error: { message: "Prompt is required." } }, { status: 400 });
    }

    const inputImages = Array.isArray(payload.inputImages)
      ? payload.inputImages.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
      : [];
    const content = [
      { type: "input_text", text: buildUserPrompt(payload) },
      ...inputImages.map((image) => ({
        type: "input_image",
        image_url: image.url!.trim(),
      })),
    ];

    const upstreamResponse = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PROMPT_IMPROVER_MODEL,
          instructions: PROMPT_IMPROVER_SYSTEM_PROMPT,
          reasoning: { effort: "medium" },
          text: { verbosity: "medium" },
          max_output_tokens: 1800,
          input: [
            {
              role: "user",
              content,
            },
          ],
        }),
        cache: "no-store",
      },
      PROMPT_IMPROVER_TIMEOUT_MS,
    );

    const responseText = await upstreamResponse.text();
    if (!upstreamResponse.ok) {
      try {
        const errorJson = JSON.parse(responseText) as OpenAIResponsePayload;
        if (errorJson.error?.message) {
          return Response.json(
            { error: { message: errorJson.error.message } },
            { status: upstreamResponse.status },
          );
        }
      } catch {
        // Fall through to raw error text.
      }

      return Response.json(
        { error: { message: responseText || "OpenAI prompt improvement failed." } },
        { status: upstreamResponse.status },
      );
    }

    const json = JSON.parse(responseText) as OpenAIResponsePayload;
    const improvedPrompt = stripMarkdownFence(extractOutputText(json));
    if (!improvedPrompt) {
      return Response.json(
        { error: { message: "No improved prompt returned from OpenAI." } },
        { status: 502 },
      );
    }

    return Response.json({
      prompt: improvedPrompt,
      model: PROMPT_IMPROVER_MODEL,
      reasoningEffort: "medium",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "OpenAI prompt improvement timed out."
        : error instanceof Error
        ? error.message
        : "OpenAI prompt improvement failed.";
    return Response.json({ error: { message } }, { status: 500 });
  }
}
