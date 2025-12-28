"use client";

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

const STYLE_EXTRACTION_PROMPT = `Extract the VISUAL STYLE for an AI Image Generator.
Your goal is to capture the aesthetic. Use JSON format to output the style. Try not to use words like "dreamy", "fantasy" or "photorealistic" since the model is probably overfitting on these words.`;

// Convert a blob URL to a data URL
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export type GenerateStyleDescriptionArgs = {
  images: Array<{ url: string; mimeType?: string }>;
  geminiApiKey: string;
};

export async function generateStyleDescription({
  images,
  geminiApiKey,
}: GenerateStyleDescriptionArgs): Promise<string> {
  const resolvedApiKey = (geminiApiKey ?? "").trim();

  if (!resolvedApiKey) {
    throw new Error("Missing Gemini API key. Add one in settings.");
  }

  if (images.length === 0) {
    throw new Error("At least one image is required to analyze style.");
  }

  // Convert images to inline data format (handle both data: and blob: URLs)
  const inlineImageParts = await Promise.all(
    images.map(async (img) => {
      let dataUrl = img.url;

      // Convert blob URL to data URL if needed
      if (img.url.startsWith("blob:")) {
        try {
          dataUrl = await blobUrlToDataUrl(img.url);
        } catch {
          return null;
        }
      }

      if (!dataUrl.startsWith("data:")) {
        return null;
      }

      const [mimePart, base64Data] = dataUrl.split(",");
      const mimeType = mimePart.match(/:(.*?);/)?.[1] || "image/png";
      return {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };
    })
  );

  const validParts = inlineImageParts.filter(
    (item): item is { inlineData: { mimeType: string; data: string } } => Boolean(item)
  );

  if (validParts.length === 0) {
    throw new Error("No valid images provided. Please add images to the style.");
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: STYLE_EXTRACTION_PROMPT }, ...validParts],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT"],
    },
  };

  // Use non-streaming endpoint for simpler text response
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    resolvedApiKey,
  )}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": resolvedApiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errJson.error?.message) {
          throw new Error(`Gemini API Error: ${errJson.error.message}`);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.startsWith("Gemini API Error")) {
          throw parseError;
        }
      }
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const textParts = json.candidates?.[0]?.content?.parts?.filter((part) => part.text) ?? [];
    const rawResponse = textParts.map((part) => part.text).join(" ").trim();

    if (!rawResponse) {
      throw new Error("No style description generated. Please try again.");
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonString = rawResponse;
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }

    return jsonString;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Style analysis timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
