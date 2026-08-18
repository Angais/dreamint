export const runtime = "nodejs";

export async function GET() {
  const upstreamResponse = await fetch("https://openrouter.ai/api/v1/images/models", {
    // The catalog changes rarely; cache it server-side for an hour.
    next: { revalidate: 3600 },
  });

  const responseText = await upstreamResponse.text();
  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });
}
