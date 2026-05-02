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
- Verification: `npm run lint`.
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
