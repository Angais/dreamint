import type { Generation } from "./types";

export function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function normalizeImages(images: string[]): string[] {
  return images.filter((src) => src && src.length > 0);
}

export function parseSeed(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function groupByDate(generations: Generation[]): {
  key: string;
  label: string;
  items: Generation[];
}[] {
  const map = new Map<string, Generation[]>();

  generations.forEach((generation) => {
    const key = new Date(generation.createdAt).toISOString().slice(0, 10);
    const existing = map.get(key) ?? [];
    existing.push(generation);
    map.set(key, existing);
  });

  return Array.from(map.entries())
    .map(([key, items]) => ({
      key,
      label: formatDisplayDate(items[0].createdAt),
      items,
    }))
    .sort((a, b) => new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime());
}

export function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
