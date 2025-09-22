﻿export type AspectKey =
  | "square-1-1"
  | "portrait-4-5"
  | "portrait-9-16"
  | "landscape-3-2"
  | "landscape-16-9"
  | "landscape-21-9";

export type QualityKey = "standard" | "high" | "ultra" | "four-k";

type AspectDefinition = {
  value: AspectKey;
  label: string;
  description: string;
  widthRatio: number;
  heightRatio: number;
  orientation: "square" | "portrait" | "landscape" | "ultrawide";
};

type QualityDefinition = {
  value: QualityKey;
  label: string;
  description: string;
  maxDimension: number;
};

export const ASPECT_OPTIONS: AspectDefinition[] = [
  {
    value: "square-1-1",
    label: "Square",
    description: "1 : 1",
    widthRatio: 1,
    heightRatio: 1,
    orientation: "square",
  },
  {
    value: "portrait-4-5",
    label: "Portrait",
    description: "4 : 5",
    widthRatio: 4,
    heightRatio: 5,
    orientation: "portrait",
  },
  {
    value: "portrait-9-16",
    label: "Story",
    description: "9 : 16",
    widthRatio: 9,
    heightRatio: 16,
    orientation: "portrait",
  },
  {
    value: "landscape-3-2",
    label: "Landscape",
    description: "3 : 2",
    widthRatio: 3,
    heightRatio: 2,
    orientation: "landscape",
  },
  {
    value: "landscape-16-9",
    label: "Widescreen",
    description: "16 : 9",
    widthRatio: 16,
    heightRatio: 9,
    orientation: "landscape",
  },
  {
    value: "landscape-21-9",
    label: "Cinematic",
    description: "21 : 9",
    widthRatio: 21,
    heightRatio: 9,
    orientation: "ultrawide",
  },
];

export const QUALITY_OPTIONS: QualityDefinition[] = [
  {
    value: "standard",
    label: "Standard",
    description: "1536 max",
    maxDimension: 1536,
  },
  {
    value: "high",
    label: "High",
    description: "2048 max",
    maxDimension: 2048,
  },
  {
    value: "ultra",
    label: "Ultra",
    description: "3072 max",
    maxDimension: 3072,
  },
  {
    value: "four-k",
    label: "4K",
    description: "4096 max",
    maxDimension: 4096,
  },
];

export function getAspectDefinition(value: AspectKey): AspectDefinition | undefined {
  return ASPECT_OPTIONS.find((option) => option.value === value);
}

export function getQualityDefinition(value: QualityKey): QualityDefinition | undefined {
  return QUALITY_OPTIONS.find((option) => option.value === value);
}

export function getAspectDescription(value: AspectKey): string {
  return getAspectDefinition(value)?.description ?? value;
}

export function getQualityLabel(value: QualityKey): string {
  return getQualityDefinition(value)?.label ?? value;
}

export function calculateImageSize(aspect: AspectKey, quality: QualityKey): { width: number; height: number } {
  const aspectDefinition = getAspectDefinition(aspect);
  const qualityDefinition = getQualityDefinition(quality);

  if (!aspectDefinition) {
    throw new Error(`Unknown aspect option: ${aspect}`);
  }

  if (!qualityDefinition) {
    throw new Error(`Unknown quality option: ${quality}`);
  }

  const { widthRatio, heightRatio } = aspectDefinition;
  const { maxDimension } = qualityDefinition;

  if (widthRatio === heightRatio) {
    return { width: maxDimension, height: maxDimension };
  }

  if (widthRatio > heightRatio) {
    const height = Math.round((maxDimension * heightRatio) / widthRatio);
    return { width: maxDimension, height };
  }

  const width = Math.round((maxDimension * widthRatio) / heightRatio);
  return { width, height: maxDimension };
}

export function formatResolution(size: { width: number; height: number }): string {
  return `${size.width}×${size.height}`;
}
