"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { deriveAspectRatioFromSize, getQualityLabel } from "../../lib/image-options";
import { totalUsageCostUsd } from "../../lib/openrouter";
import { formatDisplayDate } from "./utils";
import { useResolvedImageSource } from "./use-resolved-image-source";
import type { Generation, ReusePromptOptions } from "./types";
import { CopyIcon, LightningIcon, ReuseIcon, SettingsIcon, ShareIcon, SpinnerIcon } from "./icons";

// Simple Trash Icon for the delete button
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM5.864 5.363c-.277-.017-.553-.033-.83-.048l.845 10.518a1.25 1.25 0 001.245 1.15h4.808c.675 0 1.23-.534 1.246-1.21l.845-10.52a42.507 42.507 0 00-3.84.21c-.78-.13-1.576-.246-2.388-.348a44.77 44.77 0 00-1.931-.003z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Custom Icon for Retry
function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
    </svg>
  );
}

type GenerationDetailsCardProps = {
  generation: Generation | null;
  isGenerating: boolean;
  onUsePrompt: (prompt: string, inputImages: Generation["inputImages"], options?: ReusePromptOptions) => void;
  onPreviewInputImage?: (image: Generation["inputImages"][number]) => void;
  onDeleteGeneration?: (generationId: string) => void;
  onShareCollage?: (generationId: string) => Promise<boolean>;
  canDelete?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function GenerationDetailsCard({
  generation,
  isGenerating,
  onUsePrompt,
  onPreviewInputImage,
  onDeleteGeneration,
  onShareCollage,
  canDelete = false,
  isRetrying = false,
  onRetry,
}: GenerationDetailsCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [promptCopyState, setPromptCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [setupCopyState, setSetupCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [summaryCopyState, setSummaryCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const validInputImages = useMemo(
    () =>
      generation?.inputImages?.filter(
        (img) => typeof img?.url === "string" && img.url.trim().length > 0,
      ) ?? [],
    [generation?.inputImages],
  );

  const modelLabel = generation ? generation.modelLabel ?? generation.model : null;
  const aspectLabel = generation
    ? generation.aspectRatio === "auto"
      ? deriveAspectRatioFromSize(generation.size)
      : generation.aspectRatio
    : null;
  const actualCostUsd = generation ? totalUsageCostUsd(generation.usage ?? null) : null;

  const imageSummary = useMemo(() => {
    if (!generation) {
      return {
        hasMissingImage: false,
        hasShareTargets: false,
      };
    }

    const deletedSet = new Set(generation.deletedImages ?? []);
    let hasMissingImage = false;
    let hasShareTargets = false;

    generation.images.forEach((img, index) => {
      if (deletedSet.has(index)) {
        return;
      }
      if (img) {
        hasShareTargets = true;
      } else {
        hasMissingImage = true;
      }
    });

    return {
      hasMissingImage,
      hasShareTargets,
    };
  }, [generation]);
  const isInterrupted = !isGenerating && imageSummary.hasMissingImage;
  const hasShareTargets = imageSummary.hasShareTargets;
  const canShare =
    Boolean(onShareCollage) &&
    Boolean(generation) &&
    !isGenerating &&
    !isInterrupted &&
    hasShareTargets &&
    !isSharing;
  const createdAtDate = useMemo(
    () => (generation?.createdAt ? new Date(generation.createdAt) : null),
    [generation?.createdAt],
  );

  useEffect(() => {
    if (!isGenerating || !createdAtDate) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - createdAtDate.getTime());
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isGenerating, createdAtDate]);

  useEffect(() => {
    if (promptCopyState === "idle" && setupCopyState === "idle" && summaryCopyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPromptCopyState("idle");
      setSetupCopyState("idle");
      setSummaryCopyState("idle");
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [promptCopyState, setupCopyState, summaryCopyState]);

  const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value < 0.01 ? 4 : 2,
      maximumFractionDigits: value < 0.01 ? 4 : 2,
    }).format(value);

  const copyText = async (value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === "undefined") {
      throw new Error("Clipboard is unavailable.");
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const copyPrompt = async () => {
    if (!generation?.prompt.trim()) {
      return;
    }

    try {
      await copyText(generation.prompt);
      setPromptCopyState("copied");
    } catch (error) {
      console.error("Unable to copy generation prompt", error);
      setPromptCopyState("failed");
    }
  };

  const buildGenerationSetupMarkdown = () => {
    if (!generation) {
      return "";
    }

    const durationLabel =
      typeof generation.durationMs === "number"
        ? `${(generation.durationMs / 1000).toFixed(1)}s`
        : null;

    return [
      "# Dreamint Generation Setup",
      "",
      "## Prompt",
      generation.prompt.trim(),
      "",
      "## Settings",
      `- Model: ${modelLabel}`,
      ...(generation.providerTag ? [`- Provider: ${generation.providerTag}`] : []),
      `- Aspect: ${aspectLabel ?? "Auto"}`,
      ...(generation.resolution ? [`- Resolution: ${generation.resolution}`] : []),
      `- Output size: ${generation.size.width}x${generation.size.height}`,
      ...(generation.quality ? [`- Quality: ${getQualityLabel(generation.quality)}`] : []),
      `- Output format: ${generation.outputFormat.toUpperCase()}`,
      `- Images: ${generation.images.length}`,
      `- References: ${validInputImages.length}`,
      ...(durationLabel ? [`- Duration: ${durationLabel}`] : []),
      ...(actualCostUsd !== null ? [`- Cost: ${formatUsd(actualCostUsd)}`] : []),
      ...(generation.usage
        ? [
            "",
            "## Usage",
            ...(generation.usage.promptTokens !== null
              ? [`- Prompt tokens: ${generation.usage.promptTokens.toLocaleString()}`]
              : []),
            ...(generation.usage.completionTokens !== null
              ? [`- Completion tokens: ${generation.usage.completionTokens.toLocaleString()}`]
              : []),
            ...(generation.usage.upstreamCostUsd !== null
              ? [`- Upstream (BYOK) cost: ${formatUsd(generation.usage.upstreamCostUsd)}`]
              : []),
          ]
        : []),
    ].join("\n");
  };

  const buildGenerationSetupSummary = () => {
    if (!generation) {
      return "";
    }

    const promptPreview = generation.prompt.trim().replace(/\s+/g, " ");

    return [
      `"${promptPreview}"`,
      modelLabel,
      `${generation.size.width}x${generation.size.height}`,
      ...(generation.quality ? [getQualityLabel(generation.quality)] : []),
      generation.outputFormat.toUpperCase(),
      `${validInputImages.length} ref${validInputImages.length === 1 ? "" : "s"}`,
      ...(actualCostUsd !== null ? [formatUsd(actualCostUsd)] : []),
    ].join(" | ");
  };

  const copyGenerationSetup = async () => {
    const setupMarkdown = buildGenerationSetupMarkdown();
    if (!setupMarkdown) {
      return;
    }

    try {
      await copyText(setupMarkdown);
      setSetupCopyState("copied");
    } catch (error) {
      console.error("Unable to copy generation setup", error);
      setSetupCopyState("failed");
    }
  };

  const copyGenerationSummary = async () => {
    const setupSummary = buildGenerationSetupSummary();
    if (!setupSummary) {
      return;
    }

    try {
      await copyText(setupSummary);
      setSummaryCopyState("copied");
    } catch (error) {
      console.error("Unable to copy generation setup summary", error);
      setSummaryCopyState("failed");
    }
  };

  const formattedElapsed = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [elapsedSeconds]);

  return (
    <section className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 flex flex-col gap-4 transition-colors hover:border-[var(--border-highlight)]">

      {/* Header: Status or Date */}
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {isGenerating ? (
          <span className="flex items-center gap-2 text-[var(--accent-primary)] animate-pulse">
            <SpinnerIcon className="h-3 w-3 animate-spin" />
            <span className="flex items-center gap-1">
              <span>Generating...</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                {formattedElapsed}
              </span>
            </span>
          </span>
        ) : generation ? (
          <span>{formatDisplayDate(generation.createdAt)}</span>
        ) : (
          <span>Ready</span>
        )}

        {generation && !isGenerating && !isInterrupted ? (
          <span className="text-right text-[var(--text-secondary)]">
            {actualCostUsd !== null ? <span>{formatUsd(actualCostUsd)}</span> : null}
            {typeof generation.durationMs === "number" ? (
              <span className="block text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
                {(generation.durationMs / 1000).toFixed(1)}s
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {/* Prompt Body or Error */}
      <div className="space-y-2">
        {isInterrupted ? (
          <div className="rounded-lg border border-orange-900/50 bg-orange-950/20 px-3 py-2.5">
            <p className="text-xs text-orange-400 font-medium leading-snug mb-2">
              Request interrupted
            </p>
            <p className="text-[11px] text-orange-300/70 leading-relaxed">
              {isRetrying
                ? "A retry is running. The original request will stay here unless the retry succeeds."
                : "The page was reloaded or closed before the image finished."}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className={`mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  isRetrying
                    ? "cursor-not-allowed text-orange-300/70"
                    : "text-orange-400 hover:text-orange-300"
                }`}
                aria-disabled={isRetrying}
              >
                {isRetrying ? (
                  <SpinnerIcon className="h-3 w-3 animate-spin" />
                ) : (
                  <RetryIcon className="h-3 w-3" />
                )}
                {isRetrying ? "Retrying..." : "Retry Request"}
              </button>
            )}
          </div>
        ) : null}

        {generation && !isInterrupted ? (
          <p className="text-xs leading-relaxed text-[var(--text-primary)] opacity-90 font-normal max-h-32 overflow-y-auto">
            {generation.prompt}
          </p>
        ) : !generation ? (
          <p className="text-xs italic text-[var(--text-muted)]">
            Waiting for prompt...
          </p>
        ) : null}

      </div>

      {/* Input Images (Compact) */}
      {generation && validInputImages.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          {validInputImages.map((image, index) => (
            <ResolvedInputImageButton
              key={`${generation.id}-input-${image.id ? image.id : "ref"}-${index}`}
              image={image}
              onClick={() => onPreviewInputImage?.(image)}
            />
          ))}
        </div>
      ) : null}

      {/* Tech Specs & Actions */}
      {generation && !isInterrupted && (
        <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 gap-y-2">
          {/* Tech Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
              {modelLabel}
            </span>
            {generation.resolution ? (
              <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                {generation.resolution}
              </span>
            ) : null}
            {generation.quality ? (
              <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                {getQualityLabel(generation.quality)}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
              {aspectLabel}
            </span>
            {generation.providerTag ? (
              <span
                className="inline-flex items-center rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]"
                title={`Pinned provider${generation.allowFallbacks ? " (fallbacks allowed)" : " (no fallbacks)"}`}
              >
                {generation.providerTag.split("/")[0]}
              </span>
            ) : null}
          </div>

          {/* Compact Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyPrompt}
              className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${
                promptCopyState === "copied"
                  ? "bg-emerald-400/10 text-emerald-200"
                  : promptCopyState === "failed"
                    ? "bg-red-400/10 text-red-200"
                    : "hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title={
                promptCopyState === "copied"
                  ? "Prompt copied"
                  : promptCopyState === "failed"
                    ? "Copy failed"
                    : "Copy prompt"
              }
              aria-label="Copy generation prompt"
            >
              <CopyIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={copyGenerationSetup}
              className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${
                setupCopyState === "copied"
                  ? "bg-emerald-400/10 text-emerald-200"
                  : setupCopyState === "failed"
                    ? "bg-red-400/10 text-red-200"
                    : "hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title={
                setupCopyState === "copied"
                  ? "Setup copied"
                  : setupCopyState === "failed"
                    ? "Copy failed"
                    : "Copy generation setup"
              }
              aria-label="Copy generation setup"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={copyGenerationSummary}
              className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${
                summaryCopyState === "copied"
                  ? "bg-emerald-400/10 text-emerald-200"
                  : summaryCopyState === "failed"
                    ? "bg-red-400/10 text-red-200"
                    : "hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title={
                summaryCopyState === "copied"
                  ? "Summary copied"
                  : summaryCopyState === "failed"
                    ? "Copy failed"
                    : "Copy one-line setup summary"
              }
              aria-label="Copy one-line setup summary"
            >
              <LightningIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                onUsePrompt(
                  generation.prompt,
                  validInputImages,
                  {
                    model: generation.model,
                    aspectRatio: generation.aspectRatio,
                    resolution: generation.resolution,
                    quality: generation.quality,
                    outputFormat: generation.outputFormat,
                  },
                )
              }
              className="flex items-center justify-center h-6 w-6 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Reuse prompt in editor"
            >
              <ReuseIcon className="h-3.5 w-3.5" />
            </button>

            {onShareCollage ? (
              <button
                type="button"
                disabled={!canShare}
                onClick={async () => {
                  if (!generation || !onShareCollage || !canShare) {
                    return;
                  }
                  setIsSharing(true);
                  try {
                    await onShareCollage(generation.id);
                  } finally {
                    setIsSharing(false);
                  }
                }}
                className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${canShare
                  ? "hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  : "opacity-40 cursor-not-allowed text-[var(--text-muted)]"
                  }`}
                title={canShare ? "Share collage" : "Share is unavailable"}
                aria-label="Share collage"
              >
                <ShareIcon className={`h-3.5 w-3.5 ${isSharing ? "animate-pulse" : ""}`} />
              </button>
            ) : null}

            {canDelete && onDeleteGeneration && (
              <button
                type="button"
                onClick={() => onDeleteGeneration(generation.id)}
                className="flex items-center justify-center h-6 w-6 rounded hover:bg-red-950/30 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                title="Delete Batch"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Action for Interrupted State */}
      {isInterrupted && canDelete && onDeleteGeneration && (
        <div className="mt-auto pt-2 border-t border-[var(--border-subtle)] flex justify-end">
          <button
            type="button"
            onClick={() => onDeleteGeneration(generation!.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-950/30 text-[10px] font-semibold text-red-400/80 hover:text-red-400 transition-colors"
          >
            <TrashIcon className="h-3 w-3" />
            Discard
          </button>
        </div>
      )}
    </section>
  );
}

function ResolvedInputImageButton({
  image,
  onClick,
}: {
  image: Generation["inputImages"][number];
  onClick: () => void;
}) {
  const { resolvedSource, isResolving } = useResolvedImageSource(image.url);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block h-8 w-8 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] transition-transform hover:scale-110 hover:border-[var(--text-muted)] focus:outline-none"
      title="View reference image"
    >
      {resolvedSource ? (
        <Image
          src={resolvedSource}
          alt={image.name || "Reference image"}
          width={32}
          height={32}
          unoptimized={resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:")}
          className="h-full w-full object-cover opacity-80 hover:opacity-100"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {isResolving ? "..." : "N/A"}
        </div>
      )}
    </button>
  );
}
