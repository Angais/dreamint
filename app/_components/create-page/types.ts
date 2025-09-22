import type { SeedreamGeneration } from "../../actions/generate-seedream";
import type { AspectKey, QualityKey } from "../../lib/seedream-options";

export type PromptAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "local" | "remote";
  width?: number | null;
  height?: number | null;
};

export type Generation = SeedreamGeneration & { id: string };

export type GalleryEntry = {
  generationId: string;
  imageIndex: number;
  src: string;
  prompt: string;
  aspect: AspectKey;
  quality: QualityKey;
  size: { width: number; height: number };
};
