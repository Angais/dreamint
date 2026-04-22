import type { SeedreamGeneration } from "../../lib/generate-seedream";
import type {
  OpenAIEstimatedCostBreakdown,
  OpenAIUsageBreakdown,
} from "../../lib/openai-image-costs";
import type {
  AspectKey,
  AspectSelection,
  QualityKey,
  QualitySelection,
  Provider,
  OutputFormat,
  GeminiModelVariant,
  OpenAIModel,
  OpenAIQuality,
} from "../../lib/seedream-options";

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
  durationMs?: number;
  deletedImages?: number[];
  thumbnails?: string[];
  thoughts?: (ImageThoughts | null)[]; // Chain of thought per image
  aspectSelection?: AspectSelection;
  qualitySelection?: QualitySelection;
};

export type GalleryEntry = {
  generationId: string;
  imageIndex: number;
  src: string;
  prompt: string;
  aspect: AspectKey | "custom";
  quality: QualityKey;
  durationMs?: number;
  aspectSelection?: AspectSelection;
  qualitySelection?: QualitySelection;
  provider?: Provider;
  modelVariant?: GeminiModelVariant;
  openAIModel?: OpenAIModel;
  openAIQuality?: OpenAIQuality;
  estimatedOpenAICost?: OpenAIEstimatedCostBreakdown;
  openAIUsage?: OpenAIUsageBreakdown | null;
  outputFormat?: OutputFormat;
  size: { width: number; height: number };
  inputImages: Generation["inputImages"];
  useGoogleSearch?: boolean;
};

export type ReusePromptOptions = {
  provider?: Provider;
  useGoogleSearch?: boolean;
  modelVariant?: GeminiModelVariant;
  openAIModel?: OpenAIModel;
  openAIQuality?: OpenAIQuality;
  aspectSelection?: AspectSelection;
  qualitySelection?: QualitySelection;
  aspect?: AspectKey | "custom";
  size?: { width: number; height: number };
};
