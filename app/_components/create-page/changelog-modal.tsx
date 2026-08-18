"use client";

import { useEffect, useRef } from "react";

import { XIcon } from "./icons";

const CHANGELOG_ENTRIES = [
  {
    date: "August 18, 2026",
    changes: [
      "Dreamint now runs entirely on OpenRouter: one API key, every image model in their catalog.",
      "Settings has a searchable model manager — enable any OpenRouter image models and pick between them from the composer's new model selector.",
      "Each enabled model can pin a specific provider (e.g. Google AI Studio for BYOK); with fallbacks off, requests fail instead of silently routing elsewhere.",
      "Aspect ratio, resolution, and quality controls now adapt to whatever the selected model and provider actually support.",
      "Budget tracking now uses the real cost OpenRouter reports per generation, including upstream BYOK costs.",
      "The OpenAI-only prompt improver, legacy Gemini/FAL code paths, and token-based cost estimation were removed.",
      "Existing galleries, settings, and budgets are migrated automatically.",
    ],
  },
  {
    date: "May 6, 2026",
    changes: [
      "The composer can now save the current prompt setup as a Markdown file for handoff or archiving.",
      "Reference-image previews can now copy a JSON metadata record with name, dimensions, file type, and file size.",
      "Bulk gallery deletes now open a confirmation summary with count, format, resolution, and shape details before removing selected images.",
      "Reference-image previews now include zoom controls and drag panning for closer inspection.",
      "Gallery selection mode now supports Shift-click range selection in the current filtered result order.",
      "Selected gallery images can now copy compact one-line setup summaries for batch handoff.",
      "Gallery selection now shows a compact breakdown by current results, format, resolution, shape, and available cost.",
      "Image details can now copy a compact one-line setup summary for quick handoff.",
      "Completed generation cards can now copy a compact one-line setup summary for quick handoff.",
      "Gallery selection mode can now invert the current filtered result set without disturbing selections outside the filter.",
      "Saved prompt snippets can now be appended to the current prompt, making reusable modifiers easier to combine.",
      "Image details can now copy a Markdown setup note with prompt, model, size, format, references, source IDs, and cost or usage details.",
      "Gallery search now also matches image metadata such as format, resolution, shape, dimensions, references, and short generation IDs.",
      "The OpenAI API key setting now shows when the locally saved key was last updated.",
      "Saved prompt snippets can now be renamed inline without replacing the current composer prompt.",
      "The OpenAI API key setting now includes a Clear Key action with a short Undo window.",
      "The OpenAI API key setting can now copy the stored key without revealing it, and shows whether a key is saved locally.",
      "The OpenAI API key field now has a show/hide toggle for easier setup checks.",
      "The reference-image add button now shows how many slots are left before the eight-image limit is full.",
      "Adding duplicate or over-limit reference images now shows clear feedback instead of failing silently.",
      "The gallery empty state now explains when active controls hide every image and offers a reset action in place.",
      "Interrupted generation cards now show a disabled Retrying state while their non-destructive retry is running.",
      "Reference image previews now show available dimensions, file type, and file size beside the download action.",
      "Deleting a saved prompt snippet now shows a short Undo action that restores the previous snippet order.",
      "Deleting a single Recent prompt now shows a short Undo action before the removal is final.",
      "Reference thumbnails now show original file type and size when that metadata is available.",
      "Completed generation cards can now copy a Markdown setup note with prompt, model, size, format, references, duration, and cost details.",
      "Completed generation cards now include a compact Copy Prompt action with copied or failed feedback.",
      "Gallery thumbnails now show prompt, format, resolution, shape, and size details on hover or keyboard focus.",
      "Selected gallery metadata and ZIP exports now show a short confirmation when a download starts.",
      "Selected gallery images can now export a Markdown metadata note for prompt review or handoff.",
      "Clearing Recent prompts now shows a short Undo action so prompt history can be restored after an accidental clear.",
      "Selected gallery images can now copy a numbered prompt list with filename, format, resolution, shape, and dimensions.",
      "Reusing a completed image now shows a short confirmation naming the restored format and references.",
      "Selected gallery images can now export a standalone metadata JSON file without packaging image downloads.",
      "Selected gallery images can now export a standalone metadata CSV without downloading image files.",
      "Selected gallery ZIP exports now include a spreadsheet-ready CSV sidecar for reviewing prompts, sizes, costs, and metadata.",
      "The budget near-limit warning now includes a one-click action for adding one more batch of headroom.",
      "The composer now shows the estimated prompt token count beside word and character counts.",
      "Budget tracking now warns when the current limit only has enough room for one more batch.",
      "Reusing a completed image now restores its output format along with the prompt, references, size, and quality.",
      "Selected gallery ZIP exports now include estimated and actual cost fields in their manifest, with a cost summary before download.",
      "Gallery ZIP review now summarizes selected images by resolution and shape before download.",
      "The composer can now copy the prompt plus current generation settings as a Markdown setup note.",
      "Active gallery filters now appear as removable chips for clearing one control at a time.",
      "Clearing the composer now shows a short-lived Undo action so prompts are harder to lose by accident.",
      "Gallery search can now filter saved images by square, landscape, or portrait shape.",
      "Gallery search can now filter saved images by generation resolution.",
      "The composer now shows prompt word/character counts with Copy and Clear actions.",
      "Saved prompt snippets can now be moved earlier or later directly from the composer.",
      "Recent prompt chips can now be removed one at a time without clearing the whole history.",
      "Budget tracking now has one-click presets for 5, 10, or 25 more batches.",
      "Gallery thumbnails now have a persisted Compact/Comfortable density control.",
      "Interrupted request retries now keep the original request available unless the retry succeeds.",
    ],
  },
  {
    date: "May 2, 2026",
    changes: [
      "Reference thumbnails now show source dimensions so sizing and order are easier to verify before generating.",
      "Image details can now save a single-image JSON metadata sidecar file.",
      "Gallery controls now show a reset action when search, sort, or format filters are active.",
      "The composer now shows recent prompts as one-click chips with a clear-history action.",
      "Provider and model controls were simplified now that Dreamint only uses OpenAI.",
      "Image details now include visible zoom in, zoom out, and reset controls.",
      "Gallery sort and format controls now persist across reloads.",
      "Reference thumbnails now show the Auto sizing source and can clear a multi-image reference set at once.",
      "Image details can now copy a compact JSON metadata record for the current image.",
      "Gallery ZIP downloads now show a review summary before export.",
      "Selected gallery ZIP downloads now include manifest and prompt sidecar files for easier archival.",
      "Image details now include a Copy Prompt action for moving prompts into notes or other tools.",
      "Gallery selection can now select or deselect all current filtered results at once.",
      "Reference thumbnails can now be moved earlier or later before generating.",
      "Budget tracking now shows usage progress, next-batch impact, and per-image estimates.",
      "Gallery search now filters by output format.",
      "The composer can now save and reuse pinned prompt snippets.",
      "Gallery search now includes a newest/oldest sort control.",
      "Prompt history now persists across reloads and avoids duplicate entries.",
      "Added a changelog.",
    ],
  },
];

type ChangelogModalProps = {
  onClose: () => void;
};

export function ChangelogModal({ onClose }: ChangelogModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--text-muted)]">
              Dreamint
            </p>
            <h2 id="changelog-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Changelog
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close changelog"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            {CHANGELOG_ENTRIES.map((entry) => (
              <article
                key={entry.date}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <time className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {entry.date}
                </time>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {entry.changes.map((change) => (
                    <li key={change} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
