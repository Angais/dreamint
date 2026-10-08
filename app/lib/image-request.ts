import { getEnumValues, getRangeMax, type Background, type SupportedParameters } from "./openrouter";

export type ImageRequestOptions = {
  model: string;
  prompt: string;
  numImages: number;
  aspectRatio?: string | null;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
  background?: Background | null;
  inputReferences: string[];
};

/** Use endpoint capabilities for both new requests and retries of older jobs. */
export function buildImageRequest(options: ImageRequestOptions, parameters: SupportedParameters) {
  const body: Record<string, unknown> = { model: options.model, prompt: options.prompt };
  if (options.numImages > getRangeMax(parameters, "n", 1)) {
    throw new Error("This provider does not support this many images in one request. Generate fewer images.");
  }
  if (parameters.n) body.n = options.numImages;

  for (const [key, value] of [
    ["aspect_ratio", options.aspectRatio],
    ["resolution", options.resolution],
    ["quality", options.quality],
    ["output_format", options.outputFormat],
  ] as const) {
    if (value && getEnumValues(parameters, key)?.includes(value)) body[key] = value;
  }

  if (options.background && options.background !== "auto") {
    if (!getEnumValues(parameters, "background")?.includes(options.background)) {
      throw new Error(`This provider does not support ${options.background} backgrounds.`);
    }
    body.background = options.background;
  } else if (getEnumValues(parameters, "background")?.includes("auto")) {
    body.background = "auto";
  }

  if (body.background === "transparent" && body.output_format === "jpeg") {
    const formats = getEnumValues(parameters, "output_format");
    const alphaFormat = formats?.find((format) => format === "png" || format === "webp");
    if (!alphaFormat) throw new Error("This provider does not offer a transparent output format.");
    body.output_format = alphaFormat;
  }

  if (options.inputReferences.length > getRangeMax(parameters, "input_references", 0)) {
    throw new Error("Too many reference images for this provider.");
  }
  if (options.inputReferences.length > 0) {
    body.input_references = options.inputReferences.map((url) => ({
      type: "image_url", image_url: { url },
    }));
  }
  return body;
}
