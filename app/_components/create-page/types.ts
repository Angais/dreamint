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

export type ImageThoughts = {
  text?: string[];
  images?: string[]; // Interim thought images (base64 data URLs)
};

export type Generation = SeedreamGeneration & {
  id: string;
  deletedImages?: number[];
  thumbnails?: string[];
  thoughts?: (ImageThoughts | null)[]; // Chain of thought per image
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
  useGoogleSearch?: boolean;
};
