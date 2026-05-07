"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { calculateOpenAIActualCost } from "../../lib/openai-image-costs";
import {
  DEFAULT_OPENAI_QUALITY,
  getOpenAIQualityLabel,
  getProviderModelLabel,
  getQualityLabel,
} from "../../lib/seedream-options";
import { convertBlobToOutputFormat, extensionFromMimeType } from "./download-utils";
import { CopyIcon, DownloadIcon, MagnifyingGlassIcon, XIcon } from "./icons";
import { isStoredAssetRef, resolveStoredAssetBlob } from "./storage";
import type { Generation } from "./types";
import { useInfiniteScroll } from "./use-infinite-scroll";
import { useResolvedImageSource } from "./use-resolved-image-source";

type GalleryViewProps = {
  generations: Generation[];
  onExpand: (generationId: string, imageIndex: number) => void;
  onDeleteImages: (items: Array<{ generationId: string; imageIndex: number }>) => void;
  onDeleteImage: (generationId: string, imageIndex: number) => void;
  onDownloadImage: (generationId: string, imageIndex: number) => Promise<boolean>;
  onCopyImage: (generationId: string, imageIndex: number) => Promise<boolean>;
};

type GallerySort = "newest" | "oldest";
type GalleryFormatFilter = "all" | "png" | "jpeg" | "webp";
type GalleryResolutionFilter = "all" | "1k" | "2k" | "4k";
type GalleryOrientationFilter = "all" | "square" | "landscape" | "portrait";
type GalleryDensity = "compact" | "comfortable";

type GalleryPreferences = {
  sort: GallerySort;
  formatFilter: GalleryFormatFilter;
  resolutionFilter: GalleryResolutionFilter;
  orientationFilter: GalleryOrientationFilter;
  density: GalleryDensity;
};

const GALLERY_PREFERENCES_KEY = "seedream:gallery_preferences";
const GALLERY_SORT_VALUES: GallerySort[] = ["newest", "oldest"];
const GALLERY_FORMAT_FILTER_VALUES: GalleryFormatFilter[] = ["all", "png", "jpeg", "webp"];
const GALLERY_RESOLUTION_FILTER_VALUES: GalleryResolutionFilter[] = ["all", "1k", "2k", "4k"];
const GALLERY_ORIENTATION_FILTER_VALUES: GalleryOrientationFilter[] = [
  "all",
  "square",
  "landscape",
  "portrait",
];
const GALLERY_DENSITY_VALUES: GalleryDensity[] = ["compact", "comfortable"];

type ZipManifestItem = {
  filename: string;
  generationId: string;
  imageIndex: number;
  prompt: string;
  provider: Generation["provider"];
  outputFormat: Generation["outputFormat"];
  aspect: Generation["aspect"];
  quality: NonNullable<Generation["openAIQuality"]> | Generation["quality"];
  resolution: Generation["quality"];
  orientation: Exclude<GalleryOrientationFilter, "all">;
  createdAt: string;
  size: { width: number; height: number };
  referenceCount: number;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  generationEstimatedCostUsd: number | null;
  generationActualCostUsd: number | null;
};

type ZipManifestSourceItem = {
  id: string;
  index: number;
  prompt: string;
  provider: Generation["provider"];
  outputFormat: Generation["outputFormat"];
  aspect: Generation["aspect"];
  openAIQuality: Generation["openAIQuality"];
  quality: Generation["quality"];
  createdAt: string;
  size: Generation["size"];
  inputImages: Generation["inputImages"];
  estimatedOpenAICost: Generation["estimatedOpenAICost"];
  openAIUsage: Generation["openAIUsage"];
  imageCount: number;
};

async function sourceToBlob(source: string): Promise<Blob | null> {
  if (isStoredAssetRef(source)) {
    return resolveStoredAssetBlob(source);
  }

  try {
    const response = await fetch(source);
    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
}

function isGallerySort(value: unknown): value is GallerySort {
  return typeof value === "string" && (GALLERY_SORT_VALUES as string[]).includes(value);
}

function isGalleryFormatFilter(value: unknown): value is GalleryFormatFilter {
  return typeof value === "string" && (GALLERY_FORMAT_FILTER_VALUES as string[]).includes(value);
}

function isGalleryResolutionFilter(value: unknown): value is GalleryResolutionFilter {
  return typeof value === "string" && (GALLERY_RESOLUTION_FILTER_VALUES as string[]).includes(value);
}

function isGalleryOrientationFilter(value: unknown): value is GalleryOrientationFilter {
  return (
    typeof value === "string" && (GALLERY_ORIENTATION_FILTER_VALUES as string[]).includes(value)
  );
}

function isGalleryDensity(value: unknown): value is GalleryDensity {
  return typeof value === "string" && (GALLERY_DENSITY_VALUES as string[]).includes(value);
}

function parseGalleryPreferences(value: string | null): Partial<GalleryPreferences> {
  if (value === null) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object") {
      return {};
    }

    const record = parsed as Record<string, unknown>;

    return {
      ...(isGallerySort(record.sort) ? { sort: record.sort } : {}),
      ...(isGalleryFormatFilter(record.formatFilter) ? { formatFilter: record.formatFilter } : {}),
      ...(isGalleryResolutionFilter(record.resolutionFilter)
        ? { resolutionFilter: record.resolutionFilter }
        : {}),
      ...(isGalleryOrientationFilter(record.orientationFilter)
        ? { orientationFilter: record.orientationFilter }
        : {}),
      ...(isGalleryDensity(record.density) ? { density: record.density } : {}),
    };
  } catch {
    return {};
  }
}

function getImageOrientation(size: { width: number; height: number }): Exclude<GalleryOrientationFilter, "all"> {
  if (size.width === size.height) {
    return "square";
  }

  return size.width > size.height ? "landscape" : "portrait";
}

function buildGallerySearchText(item: {
  id: string;
  prompt: string;
  provider: Generation["provider"];
  outputFormat?: Generation["outputFormat"];
  quality: Generation["quality"];
  openAIQuality: Generation["openAIQuality"];
  aspect: Generation["aspect"];
  size: { width: number; height: number };
  inputImages: Generation["inputImages"];
}): string {
  const outputFormat = item.outputFormat ?? "png";
  const extension = getOutputExtension(outputFormat);
  const orientation = getImageOrientation(item.size);
  const dimensions = `${item.size.width}x${item.size.height}`;
  const referenceCount = item.inputImages.length;

  return [
    item.prompt,
    item.id,
    item.id.slice(0, 8),
    item.provider,
    outputFormat,
    extension,
    item.quality,
    item.openAIQuality,
    item.aspect,
    orientation,
    dimensions,
    `${item.size.width} ${item.size.height}`,
    `${referenceCount} reference`,
    `${referenceCount} references`,
    `${referenceCount} refs`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

function divideCost(value: number | null | undefined, divisor: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value / Math.max(1, divisor);
}

function getOutputExtension(outputFormat: Generation["outputFormat"] | undefined): string {
  if (outputFormat === "jpeg") {
    return "jpg";
  }

  return outputFormat ?? "png";
}

function buildManifestItem(
  item: ZipManifestSourceItem,
  filename: string,
): ZipManifestItem {
  const actualCost = calculateOpenAIActualCost(item.openAIUsage ?? null);
  const estimatedCostUsd = divideCost(
    item.estimatedOpenAICost?.totalCostUsd,
    item.estimatedOpenAICost?.imageCount ?? item.imageCount,
  );
  const actualCostUsd = divideCost(actualCost.totalCostUsd, item.imageCount);

  return {
    filename,
    generationId: item.id,
    imageIndex: item.index,
    prompt: item.prompt,
    provider: item.provider,
    outputFormat: item.outputFormat ?? "png",
    aspect: item.aspect,
    quality: item.openAIQuality ?? item.quality,
    resolution: item.quality,
    orientation: getImageOrientation(item.size),
    createdAt: item.createdAt,
    size: item.size,
    referenceCount: item.inputImages.length,
    estimatedCostUsd,
    actualCostUsd,
    generationEstimatedCostUsd: item.estimatedOpenAICost?.totalCostUsd ?? null,
    generationActualCostUsd: actualCost.totalCostUsd,
  };
}

function formatCsvValue(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function buildZipCsv(items: ZipManifestItem[]): string {
  const headers = [
    "filename",
    "prompt",
    "provider",
    "format",
    "resolution",
    "quality",
    "orientation",
    "width",
    "height",
    "references",
    "estimated_cost_usd",
    "actual_cost_usd",
    "generation_estimated_cost_usd",
    "generation_actual_cost_usd",
    "created_at",
    "generation_id",
    "image_index",
  ];
  const rows = items.map((item) => [
    item.filename,
    item.prompt,
    item.provider,
    item.outputFormat,
    item.resolution,
    item.quality,
    item.orientation,
    item.size.width,
    item.size.height,
    item.referenceCount,
    item.estimatedCostUsd,
    item.actualCostUsd,
    item.generationEstimatedCostUsd,
    item.generationActualCostUsd,
    item.createdAt,
    item.generationId,
    item.imageIndex,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => formatCsvValue(value)).join(","))
    .join("\n");
}

function buildMetadataJson(items: ZipManifestItem[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      imageCount: items.length,
      images: items,
    },
    null,
    2,
  );
}

function formatMarkdownCost(value: number | null): string {
  return value === null ? "Unavailable" : formatUsd(value);
}

function formatCountList(
  counts: Record<string, number>,
  transformLabel: (label: string) => string = (label) => label,
): string {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "None";
  }

  return entries.map(([label, count]) => `${transformLabel(label)} ${count}`).join(" / ");
}

function formatMarkdownQuote(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `> ${line.length > 0 ? line : " "}`)
    .join("\n");
}

function buildMetadataMarkdown(items: ZipManifestItem[]): string {
  const lines = [
    "# Dreamint Selection Metadata",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Images: ${items.length}`,
    "",
  ];

  items.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${item.filename}`,
      "",
      formatMarkdownQuote(item.prompt),
      "",
      `- Generation ID: ${item.generationId}`,
      `- Image index: ${item.imageIndex}`,
      `- Provider: ${item.provider}`,
      `- Format: ${item.outputFormat.toUpperCase()}`,
      `- Resolution: ${item.resolution.toUpperCase()}`,
      `- Quality: ${item.quality}`,
      `- Shape: ${item.orientation}`,
      `- Size: ${item.size.width}x${item.size.height}`,
      `- References: ${item.referenceCount}`,
      `- Estimated cost: ${formatMarkdownCost(item.estimatedCostUsd)}`,
      `- Actual cost: ${formatMarkdownCost(item.actualCostUsd)}`,
      `- Created: ${item.createdAt}`,
      "",
    );
  });

  return lines.join("\n").trimEnd() + "\n";
}

export function GalleryView({ generations, onExpand, onDeleteImages, onDeleteImage, onDownloadImage, onCopyImage }: GalleryViewProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GallerySort>("newest");
  const [formatFilter, setFormatFilter] = useState<GalleryFormatFilter>("all");
  const [resolutionFilter, setResolutionFilter] = useState<GalleryResolutionFilter>("all");
  const [orientationFilter, setOrientationFilter] = useState<GalleryOrientationFilter>("all");
  const [density, setDensity] = useState<GalleryDensity>("compact");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [showExportSummary, setShowExportSummary] = useState(false);
  const [showDeleteSummary, setShowDeleteSummary] = useState(false);
  const [flash, setFlash] = useState<{ key: string; action: "copy" | "download" } | null>(null);
  const [promptCopyStatus, setPromptCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [summaryCopyStatus, setSummaryCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const galleryPreferencesHydratedRef = useRef(false);
  const exportNoticeTimeoutRef = useRef<number | null>(null);
  const { limit, loadMoreRef } = useInfiniteScroll({
    initialLimit: 20,
    increment: 20,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedPreferences = parseGalleryPreferences(
      window.localStorage.getItem(GALLERY_PREFERENCES_KEY),
    );

    if (storedPreferences.sort) {
      setSort(storedPreferences.sort);
    }
    if (storedPreferences.formatFilter) {
      setFormatFilter(storedPreferences.formatFilter);
    }
    if (storedPreferences.resolutionFilter) {
      setResolutionFilter(storedPreferences.resolutionFilter);
    }
    if (storedPreferences.orientationFilter) {
      setOrientationFilter(storedPreferences.orientationFilter);
    }
    if (storedPreferences.density) {
      setDensity(storedPreferences.density);
    }

    galleryPreferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!galleryPreferencesHydratedRef.current || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        GALLERY_PREFERENCES_KEY,
        JSON.stringify({ sort, formatFilter, resolutionFilter, orientationFilter, density }),
      );
    } catch (error) {
      console.error("Unable to persist gallery preferences in localStorage", error);
    }
  }, [density, formatFilter, orientationFilter, resolutionFilter, sort]);

  useEffect(() => {
    return () => {
      if (exportNoticeTimeoutRef.current !== null) {
        window.clearTimeout(exportNoticeTimeoutRef.current);
      }
    };
  }, []);

  // Flatten all images into a single list for the grid
  const allImages = useMemo(() => {
    return generations.flatMap((gen) => {
      const deletedSet = new Set(gen.deletedImages ?? []);
      const imageCount = gen.images.filter((src, index) => Boolean(src) && !deletedSet.has(index)).length;
      return gen.images
        .map((src, index) => {
          const fullSrc = src;
          const thumbSrc = gen.thumbnails?.[index] || fullSrc;

          return {
            id: gen.id,
            index,
            src: thumbSrc,
            fullSrc,
            outputFormat: gen.outputFormat,
            provider: gen.provider,
            modelVariant: gen.modelVariant,
            openAIModel: gen.openAIModel,
            openAIQuality: gen.openAIQuality,
            prompt: gen.prompt,
            aspect: gen.aspect,
            quality: gen.quality,
            createdAt: gen.createdAt,
            size: gen.size,
            inputImages: gen.inputImages,
            imageCount,
            estimatedOpenAICost: gen.estimatedOpenAICost,
            openAIUsage: gen.openAIUsage,
            deleted: deletedSet.has(index),
          };
        })
        .filter((img) => Boolean(img.fullSrc) && !img.deleted);
    });
  }, [generations]);

  const filteredImages = useMemo(() => {
    const searchedImages = (() => {
      const trimmedSearch = search.trim().toLowerCase();
      const matchesSearch = (item: (typeof allImages)[number]) =>
        !trimmedSearch || buildGallerySearchText(item).includes(trimmedSearch);
      const matchesFormat = (outputFormat: string | undefined) =>
        formatFilter === "all" || (outputFormat ?? "png") === formatFilter;
      const matchesResolution = (quality: string | undefined) =>
        resolutionFilter === "all" || quality === resolutionFilter;
      const matchesOrientation = (size: { width: number; height: number }) => {
        if (orientationFilter === "all") {
          return true;
        }

        return getImageOrientation(size) === orientationFilter;
      };

      return allImages.filter(
        (img) =>
          matchesSearch(img) &&
          matchesFormat(img.outputFormat) &&
          matchesResolution(img.quality) &&
          matchesOrientation(img.size),
      );
    })();

    return [...searchedImages].sort((a, b) => {
      const firstTime = new Date(a.createdAt).getTime();
      const secondTime = new Date(b.createdAt).getTime();
      return sort === "newest" ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [allImages, formatFilter, orientationFilter, resolutionFilter, search, sort]);

  const visibleImages = useMemo(() => filteredImages.slice(0, limit), [filteredImages, limit]);
  const hasActiveGalleryControls =
    search.trim().length > 0 ||
    sort !== "newest" ||
    formatFilter !== "all" ||
    resolutionFilter !== "all" ||
    orientationFilter !== "all" ||
    density !== "compact";
  const gridDensityClass =
    density === "comfortable"
      ? "grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      : "grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
  const imageByKey = useMemo(() => {
    const map = new Map<string, (typeof allImages)[number]>();
    allImages.forEach((img) => {
      map.set(`${img.id}:${img.index}`, img);
    });
    return map;
  }, [allImages]);

  const selectedItems = useMemo(() => {
    const items: (typeof allImages)[number][] = [];
    selectedKeys.forEach((key) => {
      const item = imageByKey.get(key);
      if (item) {
        items.push(item);
      }
    });
    return items;
  }, [imageByKey, selectedKeys]);

  const activeGalleryChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const trimmedSearch = search.trim();

    if (trimmedSearch.length > 0) {
      chips.push({
        key: "search",
        label: `Search: ${trimmedSearch}`,
        onClear: () => setSearch(""),
      });
    }

    if (sort !== "newest") {
      chips.push({
        key: "sort",
        label: "Oldest first",
        onClear: () => setSort("newest"),
      });
    }

    if (formatFilter !== "all") {
      chips.push({
        key: "format",
        label: `Format: ${formatFilter.toUpperCase()}`,
        onClear: () => setFormatFilter("all"),
      });
    }

    if (resolutionFilter !== "all") {
      chips.push({
        key: "resolution",
        label: `Resolution: ${resolutionFilter.toUpperCase()}`,
        onClear: () => setResolutionFilter("all"),
      });
    }

    if (orientationFilter !== "all") {
      chips.push({
        key: "orientation",
        label: `Shape: ${orientationFilter}`,
        onClear: () => setOrientationFilter("all"),
      });
    }

    if (density !== "compact") {
      chips.push({
        key: "density",
        label: "Comfortable density",
        onClear: () => setDensity("compact"),
      });
    }

    return chips;
  }, [density, formatFilter, orientationFilter, resolutionFilter, search, sort]);

  const exportSummary = useMemo(() => {
    const countBy = (getValue: (item: (typeof allImages)[number]) => string | undefined) =>
      selectedItems.reduce<Record<string, number>>((counts, item) => {
        const value = getValue(item) ?? "png";
        counts[value] = (counts[value] ?? 0) + 1;
        return counts;
      }, {});

    const formats = countBy((item) => item.outputFormat);
    const resolutions = countBy((item) => item.quality);
    const orientations = countBy((item) => getImageOrientation(item.size));
    const referenceCount = selectedItems.reduce((total, item) => total + item.inputImages.length, 0);
    const estimatedCostUsd = selectedItems.reduce((total, item) => {
      const cost = divideCost(
        item.estimatedOpenAICost?.totalCostUsd,
        item.estimatedOpenAICost?.imageCount ?? item.imageCount,
      );
      return total + (cost ?? 0);
    }, 0);
    const actualCostUsd = selectedItems.reduce((total, item) => {
      const actualCost = calculateOpenAIActualCost(item.openAIUsage ?? null);
      const cost = divideCost(actualCost.totalCostUsd, item.imageCount);
      return total + (cost ?? 0);
    }, 0);

    return { actualCostUsd, estimatedCostUsd, formats, orientations, referenceCount, resolutions };
  }, [selectedItems]);

  const toggleSelected = (generationId: string, imageIndex: number) => {
    const key = `${generationId}:${imageIndex}`;
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setLastSelectedKey(key);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
    setShowExportSummary(false);
    setShowDeleteSummary(false);
  };

  const resetGalleryControls = () => {
    setSearch("");
    setSort("newest");
    setFormatFilter("all");
    setResolutionFilter("all");
    setOrientationFilter("all");
    setDensity("compact");
    setShowExportSummary(false);
    setShowDeleteSummary(false);
  };

  const filteredKeys = useMemo(
    () => filteredImages.map((img) => `${img.id}:${img.index}`),
    [filteredImages],
  );

  const selectRangeToImage = (generationId: string, imageIndex: number) => {
    const key = `${generationId}:${imageIndex}`;
    const currentIndex = filteredKeys.indexOf(key);
    const previousIndex = lastSelectedKey ? filteredKeys.indexOf(lastSelectedKey) : -1;

    if (currentIndex === -1 || previousIndex === -1) {
      toggleSelected(generationId, imageIndex);
      return;
    }

    const rangeStart = Math.min(currentIndex, previousIndex);
    const rangeEnd = Math.max(currentIndex, previousIndex);
    const rangeKeys = filteredKeys.slice(rangeStart, rangeEnd + 1);

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      rangeKeys.forEach((rangeKey) => next.add(rangeKey));
      return next;
    });
    setLastSelectedKey(key);
  };

  const selectedFilteredCount = useMemo(
    () => filteredKeys.filter((key) => selectedKeys.has(key)).length,
    [filteredKeys, selectedKeys],
  );

  const hasFilteredSelection = selectedFilteredCount > 0;
  const hasSelectedEveryFilteredImage =
    filteredKeys.length > 0 && selectedFilteredCount === filteredKeys.length;

  const selectFilteredImages = () => {
    if (filteredKeys.length === 0) {
      return;
    }

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      filteredKeys.forEach((key) => next.add(key));
      return next;
    });
    setLastSelectedKey(filteredKeys[filteredKeys.length - 1] ?? null);
  };

  const deselectFilteredImages = () => {
    if (filteredKeys.length === 0) {
      return;
    }

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      filteredKeys.forEach((key) => next.delete(key));
      return next;
    });
    setLastSelectedKey(null);
  };

  const invertFilteredImages = () => {
    if (filteredKeys.length === 0) {
      return;
    }

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      filteredKeys.forEach((key) => {
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
      });
      return next;
    });
    setLastSelectedKey(filteredKeys[filteredKeys.length - 1] ?? null);
  };

  const triggerFlash = useCallback((key: string, action: "copy" | "download") => {
    setFlash({ key, action });
    window.setTimeout(() => {
      setFlash((previous) =>
        previous && previous.key === key && previous.action === action ? null : previous,
      );
    }, 260);
  }, []);

  const showExportNotice = useCallback((message: string) => {
    if (exportNoticeTimeoutRef.current !== null) {
      window.clearTimeout(exportNoticeTimeoutRef.current);
    }

    setExportNotice(message);
    exportNoticeTimeoutRef.current = window.setTimeout(() => {
      setExportNotice(null);
      exportNoticeTimeoutRef.current = null;
    }, 2400);
  }, []);

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    onDeleteImages(selectedItems.map((item) => ({ generationId: item.id, imageIndex: item.index })));
    clearSelection();
  };

  const buildSelectedMetadataItems = () =>
    selectedItems.map((item, index) => {
      const safeId = item.id.slice(0, 8);
      const ext = getOutputExtension(item.outputFormat);
      const filename = `dreamint-${safeId}-${item.index + 1}-${index + 1}.${ext}`;

      return buildManifestItem(item, filename);
    });

  const downloadTextFile = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMetadataCsv = () => {
    if (selectedItems.length === 0) return;

    const manifestItems = buildSelectedMetadataItems();
    downloadTextFile(
      buildZipCsv(manifestItems),
      "text/csv;charset=utf-8",
      `dreamint-selection-metadata-${Date.now()}.csv`,
    );
    showExportNotice(
      `Metadata CSV started for ${manifestItems.length} image${manifestItems.length === 1 ? "" : "s"}.`,
    );
  };

  const handleDownloadMetadataJson = () => {
    if (selectedItems.length === 0) return;

    const manifestItems = buildSelectedMetadataItems();
    downloadTextFile(
      buildMetadataJson(manifestItems),
      "application/json;charset=utf-8",
      `dreamint-selection-metadata-${Date.now()}.json`,
    );
    showExportNotice(
      `Metadata JSON started for ${manifestItems.length} image${manifestItems.length === 1 ? "" : "s"}.`,
    );
  };

  const handleDownloadMetadataMarkdown = () => {
    if (selectedItems.length === 0) return;

    const manifestItems = buildSelectedMetadataItems();
    downloadTextFile(
      buildMetadataMarkdown(manifestItems),
      "text/markdown;charset=utf-8",
      `dreamint-selection-metadata-${Date.now()}.md`,
    );
    showExportNotice(
      `Metadata MD started for ${manifestItems.length} image${manifestItems.length === 1 ? "" : "s"}.`,
    );
  };

  const copyTextToClipboard = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("Legacy clipboard copy failed");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopySelectedPrompts = async () => {
    if (selectedItems.length === 0) return;

    const promptList = buildSelectedMetadataItems()
      .map((item, index) =>
        [
          `${index + 1}. ${item.prompt}`,
          `   ${item.filename} | ${item.outputFormat.toUpperCase()} | ${item.resolution.toUpperCase()} | ${item.orientation} | ${item.size.width}x${item.size.height}`,
        ].join("\n"),
      )
      .join("\n\n");

    try {
      await copyTextToClipboard(promptList);
      setPromptCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy selected prompts", error);
      setPromptCopyStatus("failed");
    }

    window.setTimeout(() => {
      setPromptCopyStatus("idle");
    }, 1800);
  };

  const handleCopySelectedSummaries = async () => {
    if (selectedItems.length === 0) return;

    const summaryList = selectedItems
      .map((item, index) => {
        const actualCost = calculateOpenAIActualCost(item.openAIUsage ?? null);
        const actualCostUsd = divideCost(actualCost.totalCostUsd, item.imageCount);
        const estimatedCostUsd = divideCost(
          item.estimatedOpenAICost?.totalCostUsd,
          item.estimatedOpenAICost?.imageCount ?? item.imageCount,
        );
        const costLabel =
          actualCostUsd !== null
            ? `actual ${formatUsd(actualCostUsd)}`
            : estimatedCostUsd !== null
              ? `est. ${formatUsd(estimatedCostUsd)}`
              : null;
        const modelLabel = getProviderModelLabel(
          item.provider,
          item.modelVariant,
          item.openAIModel,
        );
        const qualityLabel =
          item.provider === "openai"
            ? getOpenAIQualityLabel(item.openAIQuality ?? DEFAULT_OPENAI_QUALITY)
            : getQualityLabel(item.quality);
        const promptPreview = item.prompt.trim().replace(/\s+/g, " ");

        return [
          `${index + 1}. "${promptPreview}"`,
          modelLabel,
          `${item.size.width}x${item.size.height}`,
          qualityLabel,
          (item.outputFormat ?? "png").toUpperCase(),
          `${item.inputImages.length} ref${item.inputImages.length === 1 ? "" : "s"}`,
          ...(costLabel ? [costLabel] : []),
        ].join(" | ");
      })
      .join("\n");

    try {
      await copyTextToClipboard(summaryList);
      setSummaryCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy selected setup summaries", error);
      setSummaryCopyStatus("failed");
    }

    window.setTimeout(() => {
      setSummaryCopyStatus("idle");
    }, 1800);
  };

  const handleDownloadZip = async () => {
    if (selectedItems.length === 0 || isZipping) return;
    setShowExportSummary(false);
    setIsZipping(true);

    try {
      const zip = new JSZip();

      const manifestResults = await Promise.all(
        selectedItems.map(async (item, i) => {
          try {
            const blob = await sourceToBlob(item.fullSrc);
            if (!blob) return null;
            const downloadBlob = item.outputFormat
              ? await convertBlobToOutputFormat(blob, item.outputFormat)
              : blob;
            const ext = extensionFromMimeType(downloadBlob.type) ?? "png";
            const safeId = item.id.slice(0, 8);
            const filename = `dreamint-${safeId}-${item.index + 1}-${i + 1}.${ext}`;
            zip.file(filename, downloadBlob);
            return buildManifestItem(item, filename);
          } catch (error) {
            console.error("Failed to add image to zip", error);
            return null;
          }
        }),
      );
      const manifestItems = manifestResults.filter(
        (item): item is ZipManifestItem => item !== null,
      );

      zip.file(
        "dreamint-manifest.json",
        buildMetadataJson(manifestItems),
      );
      zip.file(
        "dreamint-prompts.txt",
        manifestItems
          .map((item, index) =>
            [
              `${index + 1}. ${item.filename}`,
              `Prompt: ${item.prompt}`,
              `Model: ${item.provider}`,
              `Format: ${item.outputFormat.toUpperCase()}`,
              `Size: ${item.size.width}x${item.size.height}`,
              `Created: ${item.createdAt}`,
            ].join("\n"),
          )
          .join("\n\n"),
      );
      zip.file("dreamint-export.csv", buildZipCsv(manifestItems));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dreamint-selection-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showExportNotice(
        `ZIP download started with ${manifestItems.length} image${manifestItems.length === 1 ? "" : "s"}.`,
      );
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Search and Filters */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto_auto]">
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <MagnifyingGlassIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your dreams..."
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] py-3 pl-11 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
          />
        </div>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as GallerySort)}
            className="h-11 bg-transparent text-sm font-semibold normal-case tracking-normal text-[var(--text-primary)] outline-none"
            aria-label="Sort gallery images"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]">
          Format
          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value as GalleryFormatFilter)}
            className="h-11 bg-transparent text-sm font-semibold uppercase tracking-normal text-[var(--text-primary)] outline-none"
            aria-label="Filter gallery by output format"
          >
            <option value="all">All</option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WEBP</option>
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]">
          Resolution
          <select
            value={resolutionFilter}
            onChange={(event) => setResolutionFilter(event.target.value as GalleryResolutionFilter)}
            className="h-11 bg-transparent text-sm font-semibold uppercase tracking-normal text-[var(--text-primary)] outline-none"
            aria-label="Filter gallery by resolution"
          >
            <option value="all">All</option>
            <option value="1k">1K</option>
            <option value="2k">2K</option>
            <option value="4k">4K</option>
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]">
          Shape
          <select
            value={orientationFilter}
            onChange={(event) =>
              setOrientationFilter(event.target.value as GalleryOrientationFilter)
            }
            className="h-11 bg-transparent text-sm font-semibold normal-case tracking-normal text-[var(--text-primary)] outline-none"
            aria-label="Filter gallery by image orientation"
          >
            <option value="all">All</option>
            <option value="square">Square</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]">
          Density
          <select
            value={density}
            onChange={(event) => setDensity(event.target.value as GalleryDensity)}
            className="h-11 bg-transparent text-sm font-semibold normal-case tracking-normal text-[var(--text-primary)] outline-none"
            aria-label="Set gallery density"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
        {hasActiveGalleryControls ? (
          <button
            type="button"
            onClick={resetGalleryControls}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <XIcon className="h-3.5 w-3.5" />
            Reset
          </button>
        ) : null}
      </div>

      {activeGalleryChips.length > 0 ? (
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
          {activeGalleryChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className="group flex max-w-full items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5 font-semibold transition-colors hover:border-[var(--border-highlight)] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              title={`Clear ${chip.label}`}
            >
              <span className="min-w-0 truncate">{chip.label}</span>
              <XIcon className="h-3 w-3 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-white" />
            </button>
          ))}
        </div>
      ) : null}

      {exportNotice ? (
        <div
          className="mx-auto flex w-full max-w-4xl items-start justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-lg shadow-black/20"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium">{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="shrink-0 rounded-full p-1 text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-200/40"
            aria-label="Dismiss export notice"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Selection Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className="px-2 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          {filteredImages.length} shown
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectionMode((prev) => !prev);
            clearSelection();
          }}
          className={`rounded-full border px-4 py-2 font-semibold transition-colors ${
            selectionMode
              ? "border-[var(--text-primary)] bg-[var(--bg-subtle)] text-white"
              : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-highlight)]"
          }`}
        >
          {selectionMode ? "Exit Select" : "Select"}
        </button>

        {selectedItems.length > 0 ? (
          <>
            <span className="px-2 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              {selectedItems.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setShowExportSummary(true);
                setShowDeleteSummary(false);
              }}
              disabled={isZipping}
              className="rounded-full bg-[var(--accent-primary)] text-black px-4 py-2 font-semibold hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isZipping ? "Zipping..." : "Review ZIP"}
            </button>
            <button
              type="button"
              onClick={handleDownloadMetadataCsv}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Metadata CSV
            </button>
            <button
              type="button"
              onClick={handleCopySelectedPrompts}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              {promptCopyStatus === "copied"
                ? "Prompts Copied"
                : promptCopyStatus === "failed"
                  ? "Copy Failed"
                  : "Copy Prompts"}
            </button>
            <button
              type="button"
              onClick={handleCopySelectedSummaries}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              {summaryCopyStatus === "copied"
                ? "Summaries Copied"
                : summaryCopyStatus === "failed"
                  ? "Copy Failed"
                  : "Copy Summaries"}
            </button>
            <button
              type="button"
              onClick={handleDownloadMetadataJson}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Metadata JSON
            </button>
            <button
              type="button"
              onClick={handleDownloadMetadataMarkdown}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Metadata MD
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteSummary(true);
                setShowExportSummary(false);
              }}
              className="rounded-full bg-red-950/40 text-red-200 border border-red-900/60 px-4 py-2 font-semibold hover:bg-red-900/60 hover:text-white"
            >
              Review Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Clear
            </button>
          </>
        ) : null}

        {selectionMode && filteredImages.length > 0 ? (
          <>
            <button
              type="button"
              onClick={hasSelectedEveryFilteredImage ? deselectFilteredImages : selectFilteredImages}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              {hasSelectedEveryFilteredImage
                ? "Deselect Results"
                : hasFilteredSelection
                  ? "Select Remaining"
                  : "Select Results"}
            </button>
            <button
              type="button"
              onClick={invertFilteredImages}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 font-semibold hover:border-[var(--border-highlight)]"
            >
              Invert Results
            </button>
          </>
        ) : null}
      </div>

      {selectedItems.length > 0 ? (
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 font-semibold">
            Current results: {selectedFilteredCount} of {filteredImages.length}
          </span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5">
            Format {formatCountList(exportSummary.formats, (label) => label.toUpperCase())}
          </span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5">
            Resolution {formatCountList(exportSummary.resolutions, (label) => label.toUpperCase())}
          </span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5">
            Shape {formatCountList(exportSummary.orientations)}
          </span>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5">
            Cost{" "}
            {exportSummary.actualCostUsd > 0
              ? `${formatUsd(exportSummary.actualCostUsd)} actual`
              : exportSummary.estimatedCostUsd > 0
                ? `${formatUsd(exportSummary.estimatedCostUsd)} est.`
                : "unavailable"}
          </span>
        </div>
      ) : null}

      {showExportSummary && selectedItems.length > 0 ? (
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-4 shadow-2xl shadow-black/20 sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                ZIP export
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                {selectedItems.length} image{selectedItems.length === 1 ? "" : "s"} selected
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Includes the images plus JSON, CSV, and prompt sidecar files.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="rounded-full bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isZipping ? "Zipping..." : "Download ZIP"}
              </button>
              <button
                type="button"
                onClick={() => setShowExportSummary(false)}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Formats
              </dt>
              <dd className="mt-1 text-[var(--text-secondary)]">
                {formatCountList(exportSummary.formats, (format) => `${format.toUpperCase()}:`)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Resolution
              </dt>
              <dd className="mt-1 text-[var(--text-secondary)]">
                {formatCountList(
                  exportSummary.resolutions,
                  (resolution) => `${resolution.toUpperCase()}:`,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Shape
              </dt>
              <dd className="mt-1 text-[var(--text-secondary)]">
                {formatCountList(exportSummary.orientations, (orientation) => `${orientation}:`)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                References
              </dt>
              <dd className="mt-1 text-[var(--text-secondary)]">
                {exportSummary.referenceCount} linked input image
                {exportSummary.referenceCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Cost
              </dt>
              <dd className="mt-1 text-[var(--text-secondary)]">
                {exportSummary.actualCostUsd > 0
                  ? `${formatUsd(exportSummary.actualCostUsd)} actual`
                  : exportSummary.estimatedCostUsd > 0
                    ? `${formatUsd(exportSummary.estimatedCostUsd)} est.`
                    : "Unavailable"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {showDeleteSummary && selectedItems.length > 0 ? (
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-red-900/50 bg-red-950/20 px-4 py-4 shadow-2xl shadow-black/20 sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-200/70">
                Delete selected
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-red-50">
                Delete {selectedItems.length} image{selectedItems.length === 1 ? "" : "s"}?
              </h2>
              <p className="mt-1 text-sm leading-6 text-red-100/75">
                This removes the selected gallery images from local history.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="rounded-full bg-red-200 px-4 py-2 text-sm font-semibold text-red-950 hover:bg-white"
              >
                Delete Images
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteSummary(false)}
                className="rounded-full border border-red-200/20 bg-black/20 px-4 py-2 text-sm font-semibold text-red-100/80 hover:border-red-100/50 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-red-100/10 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-200/60">
                Current results
              </dt>
              <dd className="mt-1 text-red-100/80">
                {selectedFilteredCount} of {filteredImages.length} selected
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-200/60">
                Formats
              </dt>
              <dd className="mt-1 text-red-100/80">
                {formatCountList(exportSummary.formats, (format) => `${format.toUpperCase()}:`)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-200/60">
                Resolution
              </dt>
              <dd className="mt-1 text-red-100/80">
                {formatCountList(
                  exportSummary.resolutions,
                  (resolution) => `${resolution.toUpperCase()}:`,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-200/60">
                Shape
              </dt>
              <dd className="mt-1 text-red-100/80">
                {formatCountList(exportSummary.orientations, (orientation) => `${orientation}:`)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {/* Grid */}
      {visibleImages.length > 0 ? (
        <>
          <div className={`grid ${gridDensityClass}`}>
            {visibleImages.map((item) => {
              const selectionKey = `${item.id}:${item.index}`;
              const isSelected = selectedKeys.has(selectionKey);
              const flashCopy = flash?.key === selectionKey && flash.action === "copy";
              const flashDownload = flash?.key === selectionKey && flash.action === "download";
              const metadataLine = [
                (item.outputFormat ?? "png").toUpperCase(),
                item.quality.toUpperCase(),
                getImageOrientation(item.size),
                `${item.size.width}x${item.size.height}`,
              ].join(" / ");

              return (
                <button
                  key={`${item.id}-${item.index}`}
                  type="button"
                  title={`${item.prompt}\n${metadataLine}`}
                  onClick={(event) => {
                    const isModifierSelect = event.ctrlKey || event.metaKey;
                    const isRangeSelect = event.shiftKey;
                    if (selectionMode || isModifierSelect || isRangeSelect) {
                      if ((isModifierSelect || isRangeSelect) && !selectionMode) {
                        setSelectionMode(true);
                      }
                      if (isRangeSelect) {
                        selectRangeToImage(item.id, item.index);
                      } else {
                        toggleSelected(item.id, item.index);
                      }
                      return;
                    }
                    onExpand(item.id, item.index);
                  }}
                  className="group relative aspect-square w-full overflow-hidden bg-[var(--bg-subtle)] focus:outline-none transform-gpu"
                >
                  <GalleryImage src={item.src} alt={item.prompt} />
                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3 pb-2 pt-8 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <p className="truncate text-[11px] font-semibold leading-4 text-white">
                      {item.prompt}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
                      {metadataLine}
                    </p>
                  </div>

	                  {selectionMode ? (
	                    <div className="pointer-events-none absolute right-2 top-2 z-10">
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-white border-white"
                            : "bg-black/40 border-white/60"
                        }`}
                      >
                        {isSelected ? (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3 text-black"
                          >
                            <path d="M4 10l4 4 8-8" />
                          </svg>
                        ) : null}
                      </div>
	                    </div>
	                  ) : null}

	                  {!selectionMode ? (
	                    <div className="absolute right-2 top-2 z-10 hidden md:flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
	                      <div
	                        role="button"
	                        tabIndex={-1}
	                        onClick={(event) => {
	                          event.stopPropagation();
	                          onDeleteImage(item.id, item.index);
	                        }}
	                        className="rounded-full bg-black/70 p-1.5 text-white hover:bg-red-900/80"
	                        aria-label="Delete image"
	                        title="Delete image"
	                      >
	                        <svg
	                          xmlns="http://www.w3.org/2000/svg"
	                          viewBox="0 0 20 20"
	                          fill="currentColor"
	                          className="h-3.5 w-3.5"
	                        >
	                          <path
	                            fillRule="evenodd"
	                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z"
	                            clipRule="evenodd"
	                          />
	                        </svg>
	                      </div>
	                      <div
	                        role="button"
	                        tabIndex={-1}
	                        onClick={async (event) => {
	                          event.stopPropagation();
	                          const ok = await onCopyImage(item.id, item.index);
	                          if (ok) triggerFlash(selectionKey, "copy");
	                        }}
	                        className={`rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 transition-transform duration-150 ${
	                          flashCopy ? "scale-110 ring-2 ring-white/70" : ""
	                        }`}
	                        aria-label="Copy image"
	                        title="Copy image"
	                      >
	                        <CopyIcon
	                          className={`h-3.5 w-3.5 ${flashCopy ? "copy-wiggle" : ""}`}
	                        />
	                      </div>
	                      <div
	                        role="button"
	                        tabIndex={-1}
	                        onClick={async (event) => {
	                          event.stopPropagation();
	                          const ok = await onDownloadImage(item.id, item.index);
	                          if (ok) triggerFlash(selectionKey, "download");
	                        }}
	                        className={`rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 transition-transform duration-150 ${
	                          flashDownload ? "scale-110 ring-2 ring-white/70" : ""
	                        }`}
	                        aria-label="Download image"
	                        title="Download image"
	                      >
	                        <DownloadIcon
	                          className={`h-3.5 w-3.5 ${flashDownload ? "download-nudge" : ""}`}
	                        />
	                      </div>
	                    </div>
	                  ) : null}
	                </button>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="h-4 w-full" />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
          <p>
            {allImages.length > 0 && hasActiveGalleryControls
              ? "No images match the current gallery controls."
              : "No images found."}
          </p>
          {allImages.length > 0 && hasActiveGalleryControls ? (
            <button
              type="button"
              onClick={resetGalleryControls}
              className="mt-4 flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-highlight)] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <XIcon className="h-3.5 w-3.5" />
              Reset controls
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const { resolvedSource, isResolving } = useResolvedImageSource(src);

  if (!resolvedSource) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {isResolving ? "Loading" : "Unavailable"}
      </div>
    );
  }

  return (
    <Image
      src={resolvedSource}
      alt={alt}
      width={512}
      height={512}
      className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
      unoptimized={resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:")}
      style={{ willChange: "transform", transform: "translateZ(0)" }}
    />
  );
}
