import type { GenerationUsage, InputImage, OutputFormat } from "../../lib/openrouter";

export type PromptAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "local" | "remote";
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type Generation = {
  id: string;
  prompt: string;
  /** OpenRouter model id, e.g. "google/gemini-3-pro-image". */
  model: string;
  /** Display name snapshot from the catalog at generation time. */
  modelLabel?: string;
  /** Pinned provider tag, if the request was routed to a specific provider. */
  providerTag?: string | null;
  allowFallbacks?: boolean;
  /** "auto" or a ratio string like "16:9". */
  aspectRatio: string;
  resolution?: string | null;
  quality?: string | null;
  outputFormat: OutputFormat;
  createdAt: string;
  /** Actual size measured from the output when available, estimated otherwise. */
  size: { width: number; height: number };
  images: string[];
  thumbnails?: string[];
  deletedImages?: number[];
  inputImages: InputImage[];
  durationMs?: number;
  usage?: GenerationUsage | null;
};

export type GalleryEntry = {
  generationId: string;
  imageIndex: number;
  src: string;
  prompt: string;
  model: string;
  modelLabel?: string;
  aspectRatio: string;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: OutputFormat;
  size: { width: number; height: number };
  durationMs?: number;
  inputImages: Generation["inputImages"];
  usage?: GenerationUsage | null;
};

export type ReusePromptOptions = {
  model?: string;
  aspectRatio?: string;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: OutputFormat;
};
