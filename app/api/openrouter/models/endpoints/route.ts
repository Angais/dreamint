import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MODEL_ID_PATTERN = /^[\w.\-]+\/[\w.\-:]+$/;

export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get("model") ?? "";
  if (!MODEL_ID_PATTERN.test(model)) {
    return Response.json({ error: { message: "A valid model id is required." } }, { status: 400 });
  }

  const upstreamResponse = await fetch(
    `https://openrouter.ai/api/v1/images/models/${model}/endpoints`,
    {
      next: { revalidate: 3600 },
    },
  );

  const responseText = await upstreamResponse.text();
  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });
}
