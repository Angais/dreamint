import type { SeedreamGeneration } from "../../lib/generate-seedream";
import type { AspectKey, QualityKey, Provider, OutputFormat } from "../../lib/seedream-options";

export type PromptAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "local" | "remote";
  width?: number | null;
  height?: number | null;
};

export type Generation = SeedreamGeneration & {
  id: string;
  deletedImages?: number[];
  thumbnails?: string[];
};

export type GalleryEntry = {
  generationId: string;
  imageIndex: number;
  src: string;
  prompt: string;
  aspect: AspectKey | "custom";
  quality: QualityKey;
  provider?: Provider;
  outputFormat?: OutputFormat;
  size: { width: number; height: number };
  inputImages: Generation["inputImages"];
};
