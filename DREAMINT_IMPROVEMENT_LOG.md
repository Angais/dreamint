# Dreamint Improvement Log

This file is the continuity point for the hourly Dreamint improvement task.

## Operating Rules

- Preserve the current UI design style. Improve ergonomics and completeness without changing the visual direction.
- Prefer one substantial, finished improvement per run. It should usually combine related UI, state, persistence, and polish work into a cohesive feature when that creates more value than a tiny isolated tweak.
- Before changing behavior, read the relevant components and reuse existing patterns.
- Keep changes coherent, testable, and reversible, but do not undershoot by default; future runs should be willing to touch multiple related files when needed to complete a meaningful feature.
- Run `npm run lint` after code changes. Run `npm run build` when touching app wiring, API routes, shared types, or generation/storage logic.
- Do not remove user work or unrelated local changes.
- Update this log after each completed run with the feature or improvement, files changed, verification, and follow-up ideas.
- When a run changes or adds an app-facing feature, also update the in-app changelog in `app/_components/create-page/changelog-modal.tsx` with a concise user-facing entry.
- Rotate across different backlog areas over time. Do not treat the previous run's follow-up ideas as the default next task; they are optional prompts, not a queue.
- Avoid more than one consecutive run in the same feature area unless the next change is clearly higher value than rotating to another backlog category.
- Treat the backlog as inspiration, not a complete roadmap. Future runs may add creative improvements outside the listed categories when they fit Dreamint's purpose and are polished, coherent, and meaningful enough to noticeably improve the product.
- From time to time, deliberately consider a fresh workflow, interaction, or delight feature that is not already named in the backlog.
- Avoid choosing trivial changes just because they are easy. When there is enough context and time, prefer deeper improvements that solve a complete workflow problem end to end.

## Improvement Backlog

- Improve prompt workflow speed: reusable prompt snippets, clearer prompt history, or stronger keyboard flow.
- Improve gallery management: filtering, sorting, bulk actions, or safer cleanup of stored assets.
- Improve generation reliability: better pending-state recovery, retry context, and error handling.
- Improve cost visibility: clearer budget controls, per-provider estimates, and spent summaries.
- Improve attachment handling: richer metadata, reorder support, or clearer constraint feedback.
- Improve download/export workflows: batch naming, ZIP metadata, and format conversion clarity.
- Improve accessibility: focus states, labels, reduced-motion behavior, and keyboard support.
- Improve responsive polish while keeping the existing design language intact.

## Run History

### 2026-05-02

- Created this tracking file and configured the hourly improvement automation.
- Baseline context: Dreamint is a Next.js image generation workspace with local-first prompt/settings/gallery state, OpenAI and Gemini provider controls, attachment editing, gallery/lightbox, cost/budget UI, and access protection.
- Verification: repository inspection only; no app code changed in this setup step.

### 2026-05-02 Prompt History Persistence

- Improved prompt workflow speed by persisting the existing five-item prompt history across reloads in localStorage.
- Submitted prompts now move to the top of history instead of creating duplicate entries.
- Files touched: `app/_components/create-page.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add explicit prompt snippet pins, expose a compact history menu, or add a clear-history action in settings.

### 2026-05-02 Gallery Sort Control

- Improved gallery management by adding a compact newest/oldest sort control next to gallery search.
- Sorting applies after prompt search and before infinite-scroll slicing, so filtered results stay ordered consistently.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add gallery filters for provider/output format, persist the preferred gallery sort, or expose a quick date jump for larger galleries.

### 2026-05-02 Pinned Prompt Snippets

- Improved prompt workflow speed by adding saved prompt snippets directly inside the composer.
- The current prompt can be pinned, reused with one click, deleted inline, deduplicated, capped at six entries, and restored from localStorage across reloads.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: support snippet renaming, add drag reorder for saved snippets, or include snippets in an import/export settings bundle.

### 2026-05-02 Gallery Provider and Format Filters

- Improved gallery management by adding compact filters for model provider and output format beside gallery search and sorting.
- Search, provider, format, and sort now combine before infinite-scroll slicing, with a visible count for the current filtered set.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: persist gallery filter preferences, add aspect/quality filters, or show active filter chips with one-click clearing.

### 2026-05-02 Budget Progress Meter

- Improved cost visibility by adding a budget usage meter to the floating budget tracker.
- The expanded tracker now shows percent used, projected percent after the next batch, current batch estimate, and per-image estimate.
- Files touched: `app/_components/create-page/budget-widget.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: show actual-vs-estimated cost deltas per completed generation, add budget threshold warnings before lockout, or support provider-specific budget summaries.

### 2026-05-02 Reference Image Reordering

- Improved attachment handling by adding earlier/later controls to reference thumbnails in the composer.
- Reordering updates the underlying attachment order used for generation, including the first-reference source for Auto aspect sizing.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/attachment-preview.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add drag-and-drop thumbnail reordering, show a first-reference badge when Auto aspect is active, or persist draft attachments across reloads.

### 2026-05-02 Gallery Result Selection

- Improved gallery bulk workflows by adding a selection action for all current filtered results.
- In selection mode, users can select every result matching the active search/provider/format filters, select remaining filtered results, or deselect the current result set without disturbing unrelated selections outside the filter.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: persist gallery filter preferences, add a compact selected-results summary by provider/format, or add a confirmation dialog that names the filtered scope before bulk delete.

### 2026-05-02 Lightbox Copy Prompt

- Improved the image detail workflow by adding a Copy Prompt action in the lightbox footer.
- Copying uses the Clipboard API with a legacy textarea fallback and shows short copied/failed button feedback.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add copy actions for full generation metadata, support exporting a prompt/settings sidecar file with downloads, or add a keyboard shortcut for copying the current lightbox prompt.

### 2026-05-02 ZIP Export Metadata

- Improved download/export workflows by adding sidecar metadata to selected gallery ZIP downloads.
- ZIP exports now include `dreamint-manifest.json` with filename, prompt, provider, format, size, timestamp, quality, and reference count for each exported image, plus a readable `dreamint-prompts.txt` prompt list.
- Selected items remain available to bulk actions even when gallery filters change after selection.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a visible export summary before ZIP creation, include cost details in the manifest when available, or support downloading metadata for a single lightbox image.

### 2026-05-02 Gallery ZIP Review Summary

- Improved download/export workflows by adding a review step before selected gallery ZIP downloads.
- The summary shows selected image count, included sidecar files, model counts, format counts, and linked reference-image count before ZIP creation begins.
- Tightened the ZIP manifest item type so production type checking accepts the metadata export path.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add cost fields to the ZIP manifest when available, expose a single-image metadata download from the lightbox, or add a small gallery seed helper for faster local checks.

### 2026-05-02 Lightbox Copy Metadata

- Improved image detail/export ergonomics by adding a Copy Metadata action to the lightbox.
- The copied JSON includes prompt, provider/model, aspect, quality, format, size, duration, reference count, Google Search usage, OpenAI cost fields, and usage data when available.
- The action uses the same clipboard fallback and copied/failed feedback pattern as Copy Prompt.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a single-image metadata file download, include copied metadata presets for Markdown/CSV, or surface the metadata action in gallery selection exports.

### 2026-05-02 Reference Set Controls

- Improved attachment handling by adding a compact Clear action for multi-image reference sets in the composer.
- Added an Auto badge to the first reference thumbnail when Auto aspect sizing is active, making the sizing source visible after uploads or reordering.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/attachment-preview.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add drag-and-drop thumbnail reordering, persist draft attachments across reloads, or show dimensions on reference hover.

### 2026-05-02 Gallery Preference Persistence

- Improved gallery ergonomics by persisting the sort, model filter, and output format filter across reloads.
- Stored preferences are validated before use so stale or malformed localStorage values fall back to defaults.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a one-click reset for active gallery controls, persist gallery density preferences, or add aspect/quality filters for larger galleries.

### 2026-05-02 Lightbox Zoom Controls

- Improved image inspection by adding visible zoom in, zoom out, and reset controls inside the lightbox preview.
- The controls show the current zoom percentage, clamp to the existing 50%-800% range, reset pan and scale together, and avoid starting image drag gestures when clicked.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/icons.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add keyboard shortcuts for zoom/reset, fit-to-width/actual-size toggles, or a small reduced-motion pass for lightbox transitions.

### 2026-05-02 OpenAI-Only UI Cleanup

- Removed the Gallery model/provider filter because Dreamint now only exposes OpenAI generation.
- Removed the single-option model selector and legacy non-OpenAI provider controls from the composer/settings UI.
- Gallery preferences now persist only sort and output format, ignoring older stored provider-filter values.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: remove remaining legacy Gemini/FAL generation branches from the data layer, migrate old stored generations to OpenAI labels, or rename remaining `seedream:*` storage keys in a planned migration.

### 2026-05-06 Visible Recent Prompts

- Improved prompt workflow speed by showing the persisted prompt history as compact Recent chips directly in the composer.
- Recent prompts exclude the current prompt, restore into the composer with one click, keep the textarea focused, and include a clear-history action.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add per-prompt delete controls for recent prompts, support drag-reordering saved snippets, or add a small import/export bundle for local prompt assets.

### 2026-05-06 Gallery Control Reset

- Improved gallery management by adding a reset action that appears when search, sort, or format controls differ from the default view.
- Reset clears the search query, restores newest-first sorting, returns the format filter to All, and closes any open ZIP review summary.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add aspect/quality filters for larger galleries, add gallery density preferences, or show active filter chips with one-click clearing.

### 2026-05-06 Single-Image Metadata Download

- Improved download/export workflows by adding a Save JSON action to the lightbox metadata controls.
- The saved sidecar uses the same metadata payload as Copy JSON, with prompt, model, output settings, size, duration, reference count, cost, and usage data when available.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add Markdown/CSV metadata presets, include metadata download from gallery item actions, or add cost fields to selected ZIP manifests.

### 2026-05-06 Reference Dimension Labels

- Improved attachment handling by showing known source dimensions under each reference thumbnail in the composer.
- The first reference still shows the Auto badge when Auto aspect sizing is active, now paired with its exact size so the sizing source is clearer before generation.
- Files touched: `app/_components/create-page/attachment-preview.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add drag-and-drop thumbnail reordering, persist draft attachments across reloads, or show file size/type metadata on reference hover.

### 2026-05-06 Safer Interrupted Retry

- Improved generation reliability by making interrupted-request retries non-destructive.
- Retrying an interrupted card now keeps the original request visible while the retry is running, only replacing it after a successful result so failed retries can be attempted again.
- Retried OpenAI generations now preserve estimated cost metadata and update the spent tracker from actual usage when available.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: show retry progress on the original interrupted card, add retry failure history, or expose a bulk retry action for multiple interrupted requests.

### 2026-05-06 Gallery Density Preference

- Improved gallery scanning by adding a persisted Compact/Comfortable density control beside the existing search, sort, and format controls.
- Compact remains the default grid, while Comfortable uses larger thumbnails and wider gaps for closer visual inspection.
- Reset now restores the density preference along with search, sort, and format controls.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add aspect/quality filters for larger galleries, show active filter chips with one-click clearing, or add a saved view preset for gallery controls.

### 2026-05-06 Budget Preset Chips

- Improved cost visibility by adding one-click budget presets for 5, 10, or 25 more batches in the budget tracker.
- Presets include current spending plus the active batch estimate, so choosing a preset creates usable headroom instead of ignoring already-spent cost.
- Files touched: `app/_components/create-page/budget-widget.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a near-limit warning before the Generate button locks, show actual-vs-estimated deltas per generation, or add provider/model cost trend summaries if more models return.

### 2026-05-06 Gallery Metadata Search

- Improved gallery discovery by expanding the existing search box beyond prompt text.
- Search now matches visible metadata including output format, file extension, resolution, shape, dimensions, reference count, provider, aspect, and short generation IDs.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add highlighted search matches on thumbnail hover, support quoted exact-match search terms, or add saved gallery search presets.

### 2026-05-06 Gallery Active Filter Chips

- Improved gallery scanning by showing active search, sort, format, resolution, shape, and density controls as removable chips beneath the gallery toolbar.
- Each chip clears only its own control, while the existing Reset action remains available for restoring the full default gallery view.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add saved gallery view presets, include selected-result summaries by resolution/shape, or add keyboard shortcuts for clearing active gallery controls.

### 2026-05-06 Per-Prompt Recent Delete

- Improved prompt workflow cleanup by adding a delete control to each Recent prompt chip in the composer.
- Users can now prune one stale prompt without clearing the entire persisted history, while reusing a recent prompt still restores it and refocuses the textarea.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add drag-reordering for saved snippets, add a confirm/undo affordance for clearing all recent prompts, or include prompt history/snippets in an import/export settings bundle.

### 2026-05-06 Saved Snippet Reordering

- Improved prompt workflow speed by adding earlier/later controls to saved prompt snippets in the composer.
- Reordered snippets persist through the existing localStorage-backed snippet list, so frequently reused prompts can stay in the preferred order across reloads.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add drag-reordering for saved snippets, add snippet labels, or include prompt history/snippets in an import/export settings bundle.

### 2026-05-06 Prompt Utility Row

- Improved composer ergonomics by adding a compact prompt utility row with live word/character counts.
- The current prompt can now be copied with copied/failed feedback or cleared while keeping focus in the textarea.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add an undo affordance after clearing the prompt, include approximate token counts beside the word count, or support copying prompt plus current settings as Markdown.

### 2026-05-06 Gallery Resolution Filter

- Improved gallery management by adding a persisted resolution filter alongside search, sort, format, and density controls.
- The new filter narrows saved images to All, 1K, 2K, or 4K results using each generation's stored resolution tier, and Reset now clears it with the other gallery controls.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add aspect/orientation filters for larger galleries, show active filter chips with one-click clearing, or include resolution counts in the ZIP review summary.

### 2026-05-06 Gallery Shape Filter

- Improved gallery management by adding a persisted Shape filter for All, Square, Landscape, or Portrait images.
- The filter uses each saved image's stored dimensions, combines with search/sort/format/resolution/density controls, and resets with the rest of the gallery controls.
- Adjusted the responsive gallery control grid so the additional control wraps cleanly on smaller screens while preserving the existing pill style.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: show active filter chips with one-click clearing, include shape counts in the ZIP review summary, or add saved gallery view presets.

### 2026-05-06 Prompt Clear Undo

- Improved prompt workflow safety by adding a short-lived Undo action after clearing the composer.
- The cleared prompt is kept only in component state, restores focus to the textarea when undone, and disappears after a few seconds or once the user starts typing a new prompt.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add undo for clearing all recent prompts, include approximate token counts beside the prompt stats, or support copying prompt plus current settings as Markdown.

### 2026-05-06 Prompt Setup Copy

- Improved prompt handoff by adding a Copy Setup action beside the existing prompt copy control.
- The copied Markdown includes the prompt, aspect, resolution mode and size, quality, output format, image count, reference count, and estimated cost when available.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a lightbox action for copying completed-image settings as Markdown, include saved snippets in a local export bundle, or add a one-click restore from copied setup text.

### 2026-05-06 ZIP Resolution and Shape Summary

- Improved gallery export confidence by adding resolution and shape breakdowns to the selected-image ZIP review panel.
- ZIP manifests now include each exported image's stored resolution tier and square/landscape/portrait orientation alongside the existing prompt, format, size, and reference metadata.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add estimated/actual cost fields to the ZIP manifest, add a CSV sidecar for spreadsheet review, or add saved gallery view presets.

### 2026-05-06 ZIP Cost Metadata

- Improved gallery export accounting by adding selected-image cost metadata to ZIP exports.
- The ZIP review panel now shows an estimated or actual selected-cost summary when saved OpenAI cost data is available.
- `dreamint-manifest.json` now includes per-exported-image estimated/actual allocated cost plus the source generation's estimated/actual total cost.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a CSV sidecar for spreadsheet review, show cost totals by generation in the ZIP review panel, or add a gallery saved-view preset.

### 2026-05-06 Reuse Output Format Restore

- Improved the completed-image reuse workflow so Reuse Prompt restores the original output format along with prompt text, references, aspect, resolution, and quality.
- The restore path now accepts PNG, JPEG, or WEBP from both generation cards and the lightbox reuse action.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/types.ts`, `app/_components/create-page/generation-details-card.tsx`, `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: show a small “settings restored” confirmation after reuse, add output-format chips to gallery thumbnails, or include output format in prompt setup copy restore experiments.

### 2026-05-06 Budget Near-Limit Warning

- Improved budget visibility by adding a distinct amber warning state when the current limit only has enough remaining room for one more batch.
- The floating budget pill now signals the near-limit state before generation locks, and the expanded tracker explains that generation will pause after the next batch unless the limit is raised or cleared.
- Files touched: `app/_components/create-page/budget-widget.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a one-click “raise by next batch” action from the warning, show budget warnings near the Generate button, or add actual-vs-estimated cost deltas per completed generation.

### 2026-05-06 Prompt Token Count

- Improved prompt drafting visibility by showing the estimated prompt token count beside the existing word and character counts in the composer.
- The count reuses the existing OpenAI cost estimate data, so it updates with the prompt without adding separate tokenization state.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add token-count warning thresholds for very long prompts, show input-image token counts in the composer, or include token counts in copied setup notes.

### 2026-05-06 Budget Headroom Action

- Improved budget limit recovery by adding a one-click Add next batch action to the near-limit warning.
- The action raises the current budget by the active batch estimate, updates the budget input, and keeps the existing preset/save flow intact.
- Files touched: `app/_components/create-page/budget-widget.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: show budget warnings near the Generate button, add actual-vs-estimated cost deltas per completed generation, or show historical budget changes in local state.

### 2026-05-06 ZIP CSV Sidecar

- Improved gallery export review by adding a spreadsheet-ready `dreamint-export.csv` sidecar to selected-image ZIP downloads.
- The CSV is generated from the same typed manifest data and includes filename, prompt, provider, format, resolution, quality, shape, dimensions, reference count, cost fields, timestamps, and source IDs.
- Updated the ZIP review copy and in-app changelog so users know CSV metadata is included with JSON and prompt sidecars.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a selected-cost breakdown grouped by generation, add saved gallery view presets, or support a standalone metadata-only export for selected images.

### 2026-05-06 Standalone Gallery Metadata CSV

- Improved gallery export speed by adding a Metadata CSV action for selected images.
- The export reuses the ZIP manifest fields and downloads a spreadsheet-ready CSV without fetching or packaging image blobs.
- Refactored selected-image metadata construction so ZIP sidecars and standalone CSV stay aligned.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add a standalone JSON metadata export, show selected-cost totals grouped by generation, or add saved gallery view presets.

### 2026-05-06 Standalone Gallery Metadata JSON

- Improved gallery export speed by adding a Metadata JSON action for selected images.
- The standalone JSON download uses the same manifest payload as ZIP exports, including prompt, format, resolution, shape, size, reference count, cost fields, timestamps, and source IDs.
- Refactored ZIP manifest generation through the shared JSON builder so ZIP and standalone JSON exports stay aligned.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: show selected-cost totals grouped by generation, add saved gallery view presets, or add a metadata export success toast.

### 2026-05-06 Reuse Setup Confirmation

- Improved completed-image reuse feedback by showing a short confirmation after Reuse Prompt restores a setup.
- The notice appears in the Create view, names the restored output format and reference count, can be dismissed manually, and clears automatically after a few seconds.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: include aspect and resolution in the restored setup notice, add a direct undo for restored settings, or add similar success feedback for gallery metadata exports.

### 2026-05-06 Selected Prompt List Copy

- Improved gallery handoff workflows by adding a Copy Prompts action for selected images.
- The copied text is a numbered prompt list with filename, output format, resolution, shape, and pixel dimensions for each selected image, using the same selected metadata source as CSV/JSON/ZIP exports.
- The action shows short copied/failed feedback and uses the Clipboard API with the existing textarea fallback pattern.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a Markdown metadata preset for selected images, add grouped prompt copy by generation, or show a lightweight export success toast for CSV/JSON downloads.

### 2026-05-06 Recent Prompt Clear Undo

- Improved prompt workflow safety by adding a short-lived Undo action after clearing all Recent prompts.
- The composer keeps a temporary snapshot of the cleared local prompt history, restores it on Undo, and drops the snapshot once new history appears or the undo window expires.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add a local import/export bundle for prompt history and snippets, add snippet labels, or show a small confirmation after deleting a single recent prompt.

### 2026-05-06 Selected Metadata Markdown Export

- Improved gallery handoff workflows by adding a Metadata MD action for selected images.
- The Markdown export reuses the selected-image manifest data and includes prompt text, filename, source IDs, format, resolution, quality, shape, dimensions, reference count, cost fields, and creation time in a readable note.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add selected export success feedback, group Markdown exports by generation, or add a saved gallery view preset.

### 2026-05-06 Selected Export Confirmation

- Improved gallery export feedback by showing a short dismissible confirmation when selected CSV, JSON, Markdown, or ZIP downloads start.
- The confirmation names the export type and selected image count, using the existing gallery notice styling without changing selection behavior.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: group Markdown exports by generation, add a saved gallery view preset, or keep a lightweight recent export history in local state.

### 2026-05-06 Gallery Thumbnail Metadata Overlay

- Improved gallery scanning by showing each thumbnail's prompt, output format, resolution, shape, and dimensions on hover or keyboard focus.
- Added a native title fallback with the same prompt and metadata so dense thumbnails are easier to inspect without opening the lightbox.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a reduced-motion alternative for hover transitions, let users toggle metadata overlays on persistently in Comfortable density, or include creation time in the thumbnail detail strip.

### 2026-05-06 Generation Card Copy Prompt

- Improved completed-image handoff by adding a compact Copy Prompt action to each generation details card.
- The action copies the exact generation prompt without opening the lightbox or reusing settings, and shows short copied/failed visual feedback.
- Files touched: `app/_components/create-page/generation-details-card.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a generation-card Copy Setup action, expose Markdown copy from completed cards, or show a short text label on hover for compact card actions.

### 2026-05-06 Generation Card Copy Setup

- Improved completed-image handoff by adding a compact Copy Setup action to each generation details card.
- The copied Markdown includes the prompt, model, aspect, resolution, output size, quality, format, image/reference counts, duration, and available estimated/actual OpenAI cost and usage details.
- Reused the existing Clipboard API plus textarea fallback pattern and copied/failed visual feedback from the card's Copy Prompt action.
- Files touched: `app/_components/create-page/generation-details-card.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add short hover labels for compact generation-card actions, include per-reference filenames in setup notes, or add a one-click copy for a compact single-line setup summary.

### 2026-05-06 Reference File Metadata Labels

- Improved attachment handling by capturing original file type and byte size for newly uploaded reference images.
- Reference thumbnail labels and native hover titles now show type/size metadata when available, alongside the existing dimensions and Auto sizing badge.
- Reused the generation input-image metadata path so reused references can preserve file metadata across saved generations.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/attachment-preview.tsx`, `app/_components/create-page/types.ts`, `app/lib/generate-seedream.ts`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: include reference filenames and file metadata in copied setup notes, show metadata in the reference preview lightbox, or add a warning for oversized reference files before generation.

### 2026-05-06 Single Recent Prompt Delete Undo

- Improved prompt history safety by adding a short-lived Undo action after deleting one Recent prompt chip.
- The composer stores a temporary snapshot of the prompt history before the individual delete, restores it on Undo, and clears the snapshot when the undo window expires or the full history is cleared.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add undo for saved snippet deletion, include prompt history/snippets in a local export bundle, or show a compact prompt-history manager in settings.

### 2026-05-06 Saved Snippet Delete Undo

- Improved saved prompt safety by adding a short-lived Undo action after deleting one saved prompt snippet.
- The composer snapshots the saved snippet list before deletion, restores the previous snippet order on Undo, and keeps focus in the prompt box after restoration.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: include prompt history/snippets in a local export bundle, add snippet labels, or show a compact prompt-history manager in settings.

### 2026-05-06 Reference Preview Metadata

- Improved reference inspection by showing available dimensions, file type, and file size in the large reference image preview.
- The metadata uses the same compact label language as reference thumbnails and works for both newly uploaded references and reused generation input images when metadata is available.
- Files touched: `app/_components/create-page/attachment-lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add copy/download metadata for a single reference, show reference order in the preview, or add oversized-reference warnings before generation.

### 2026-05-06 Interrupted Retry Progress

- Improved generation reliability feedback by marking interrupted generation cards as Retrying while a non-destructive retry is running.
- Duplicate retry clicks are now ignored and the retry button is disabled with a spinner until the retry succeeds or fails, while the original interrupted request remains available on failure.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/generation-list.tsx`, `app/_components/create-page/generation-details-card.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: show retry failure count/history on interrupted cards, add bulk retry for multiple interrupted requests, or show a lightweight toast when a retry replaces the interrupted card.

### 2026-05-06 Gallery Filter Empty State

- Improved gallery management by making the empty state distinguish between a truly empty gallery and active controls hiding all images.
- When saved images exist but filters/search/sort/density controls produce no visible results, the empty state now offers a Reset controls action that uses the existing gallery reset behavior.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: show per-filter result counts, add saved gallery view presets, or make selection summaries reflect the current no-results scope.

### 2026-05-06 Reference Add Feedback

- Improved attachment handling by showing clear feedback when pasted, dropped, selected, or reused reference images are skipped because they are duplicates or exceed the eight-image limit.
- Batch attachment adds now keep valid new references while naming partial max-limit adds instead of silently ignoring the overflow.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add a non-error toast style for harmless attachment notices, show remaining reference slots beside the add button, or support replacing an existing duplicate reference from the duplicate warning.

### 2026-05-06 Reference Slot Counter

- Improved attachment handling by showing the remaining reference-image slots directly below the add-reference button.
- The add button now exposes the same slot status through its title and aria label, and switches to a clear Full state when the eight-image cap is reached.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add a non-error toast style for harmless attachment notices, support replacing an existing duplicate reference from the duplicate warning, or add drag-and-drop thumbnail reordering.

### 2026-05-06 API Key Visibility Toggle

- Improved setup ergonomics by adding a show/hide toggle to the OpenAI API key field in settings.
- The key remains masked by default, can be revealed only on demand, and keeps the same local-only storage behavior.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/icons.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a copy-key button with masking-aware feedback, show a saved-key status indicator without exposing the value, or add a connection test action for validating the key before generation.

### 2026-05-06 API Key Copy Status

- Improved setup ergonomics by adding a masked Copy Key action beside the OpenAI API key visibility toggle.
- The settings panel now shows copied/failed feedback on the copy button and a compact saved/not-saved local key status without revealing the key.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a connection test action for validating the key before generation, show last-successful-use status, or add a clear-key confirmation.

### 2026-05-06 API Key Clear Undo

- Improved setup safety by adding a deliberate Clear Key action to the OpenAI API key setting.
- Clearing the locally saved key now shows a short Undo action that restores the previous value without revealing it.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a connection test action for validating the key before generation, show last-successful-use status, or add a masked key age/updated timestamp.

### 2026-05-06 Saved Snippet Rename

- Improved prompt workflow speed by adding inline rename controls to saved prompt snippets.
- Renaming preserves the snippet order, deduplicates against existing saved prompts, supports Enter to save and Escape to cancel, and keeps focus in the composer after the edit.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/icons.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add snippet labels separate from prompt text, include prompt history/snippets in a local export bundle, or add a compact prompt manager in settings.

### 2026-05-06 API Key Updated Status

- Improved setup confidence by showing when the locally saved OpenAI API key was last updated in the settings panel.
- The timestamp is stored separately from the key, is cleared with the key, restored on Undo, and falls back gracefully for older saved keys without timestamp metadata.
- Files touched: `app/_components/create-page.tsx`, `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`; `npm run build`.
- Follow-up ideas: add a connection test action for validating the key before generation, show last-successful-use status, or add an optional key nickname for multi-account workflows.

### 2026-05-06 Lightbox Copy Setup

- Improved image detail handoff by adding a Copy Setup action to the lightbox.
- The copied Markdown includes prompt, model, aspect, output size, quality, format, image/reference counts, source IDs, duration, cost, and OpenAI usage details when available.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a one-click compact setup summary, include reference filenames in lightbox setup notes, or add copy/download actions for individual reference metadata.

### 2026-05-06 Prompt Snippet Append

- Improved prompt workflow speed by adding an append action to saved prompt snippets.
- Snippets can now be added below the current composer text without replacing the draft, making reusable style and constraint modifiers easier to combine.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add snippet categories, support multi-select snippet assembly, or add a dedicated modifier-only snippet mode.

### 2026-05-06 Gallery Invert Selection

- Improved gallery bulk workflows by adding an Invert Results action while selection mode is active.
- The action toggles selection for every image in the current filtered result set while preserving selections outside that search/filter scope.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a selected-results breakdown by current filter, support range selection from keyboard focus, or add a confirmation summary before bulk delete.

### 2026-05-06 Generation Card One-Line Setup Copy

- Improved completed-image handoff by adding a compact one-line setup summary copy action to each completed generation card.
- The copied summary includes the prompt, model, output size, quality, format, reference count, and available estimated or actual cost in a paste-friendly single line.
- Files touched: `app/_components/create-page/generation-details-card.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: expose the same one-line setup summary from the lightbox, add reference filenames to setup summaries, or let selected gallery exports include a compact summary column.

### 2026-05-06 Lightbox One-Line Setup Copy

- Improved image detail handoff by adding a compact Copy Summary action to the lightbox.
- The copied line includes the prompt, model, output size, quality, format, reference count, and available estimated or actual generation cost without requiring the full Markdown setup note.
- Files touched: `app/_components/create-page/lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: include reference filenames in setup summaries, add a selected-gallery compact summary column, or add a copy-history toast for repeated handoffs.

### 2026-05-06 Gallery Selection Breakdown

- Improved gallery bulk workflows by showing a compact selected-image breakdown without opening the ZIP review panel.
- The selection summary now shows how many selected images are in the current result set, plus format, resolution, shape, and available estimated or actual cost totals.
- Reused the same summary helper in the ZIP review panel so visible selection counts stay consistent across the gallery.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a selected-gallery compact summary export column, support keyboard range selection, or show selected references/source filenames in the summary.

### 2026-05-06 Selected One-Line Setup Copy

- Improved gallery handoff workflows by adding a Copy Summaries action for selected images.
- The copied list gives each selected image a compact one-line setup with prompt, model, output size, quality, format, reference count, and available estimated or actual per-image cost.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add selected setup summaries to Markdown exports, include reference filenames in selected summaries, or support keyboard range selection in gallery selection mode.

### 2026-05-06 Gallery Range Selection

- Improved gallery bulk workflows by adding Shift-click range selection for thumbnails.
- Range selection follows the current filtered and sorted result order, so search, format, resolution, shape, and sort controls define the selected span.
- Existing single-image toggles, current-result selection, deselection, and invert controls now update the range anchor coherently.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add keyboard range selection from focused thumbnails, show the current range anchor in selection summaries, or add a visible confirmation before bulk delete.

### 2026-05-06 Reference Preview Zoom

- Improved reference-image inspection by adding zoom controls and drag panning to the attachment lightbox.
- The preview now supports 50%-800% zoom, wheel zooming, percent reset feedback, and resets cleanly when switching reference images.
- Files touched: `app/_components/create-page/attachment-lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add touch pinch support to reference previews, expose a copy-reference-metadata action, or add next/previous navigation when previewing generation reference sets.

### 2026-05-06 Gallery Delete Confirmation

- Improved gallery bulk safety by replacing immediate selected-image deletion with a Review Delete action.
- The confirmation panel summarizes the selected count, current-result scope, formats, resolutions, and shapes before removing local gallery images.
- Opening the ZIP review and delete review now dismiss each other so only one bulk-action panel is active at a time.
- Files touched: `app/_components/create-page/gallery-view.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a short undo window after bulk delete, include selected source/reference filename counts in the delete summary, or add keyboard confirmation handling for selection mode.

### 2026-05-06 Reference Metadata Copy

- Improved reference-image inspection by adding a Copy Metadata action to the attachment lightbox.
- The copied JSON includes the reference name, optional ID, dimensions, MIME/file type, byte size, and readable file-size label with copied/failed feedback.
- Files touched: `app/_components/create-page/attachment-lightbox.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: add a metadata JSON download for single references, include reference filenames in copied setup notes, or add next/previous navigation when previewing generation reference sets.

### 2026-05-06 Composer Setup Markdown Download

- Improved prompt handoff by adding a Save Setup action beside the existing Copy Setup composer control.
- The action downloads the current prompt setup as a Markdown file using the same prompt, settings, reference count, and estimated-cost details as the clipboard setup note.
- Files touched: `app/_components/create-page/header.tsx`, `app/_components/create-page/changelog-modal.tsx`, `DREAMINT_IMPROVEMENT_LOG.md`.
- Verification: `npm run lint`.
- Follow-up ideas: include reference filenames in composer setup notes, add a JSON setup export, or bundle prompt history/snippets into a local settings export.
