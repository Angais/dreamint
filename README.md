# Dreamint

Dreamint is a browser-based workspace for generating and editing images with the Gemini 3 Pro Image Preview model on FAL or the Gemini API. It focuses on quick prompts, format/quality tweaks, and lightweight history so you can experiment without extra setup.

> WARNING: YOU USE THIS AT YOUR OWN RISK. YOU ARE RESPONSIBLE FOR ANY API COSTS, ERRORS, OR MISBEHAVIOR.

## What’s included
- Prompt composer with aspect presets, quality levels (1K/2K/4K), and output format selection (PNG/JPEG/WEBP).
- Up to eight reference images for edits; drag-and-drop, paste, or file picker.
- Batch generation (1–4 images) with local gallery, metadata chips, and one-click “Use prompt” restore.
- Lightbox with keyboard/scroll navigation, download in your selected format, and edit-from-image shortcut.
- Interrupted request recovery: pending jobs saved locally are marked “Interrupted” after reload/close with Retry/Delete options; placeholders show an interrupted state.
- Local-first state: prompts/settings in `localStorage`; gallery and pending items in IndexedDB via `localforage`. API keys stay in the browser only.

## Requirements
- Node.js 18+
- FAL API key for Gemini 3 Pro Image Preview or a Gemini API key.

## Setup
```bash
npm install
```

## Running locally
1) Provide credentials (any of these):
   - Add `FAL_API_KEY` to `.env.local`, **or**
   - Use the in-app Settings toggle to paste your key(s).
2) Start dev server:
```bash
npm run dev
```
3) Open http://localhost:3000

## Using the app
- Choose aspect, quality, and **Output Format** from the control bar. The format is sent to FAL and used when downloading from the lightbox.
- Add reference images (max 8). If the first image has clear dimensions, the aspect auto-adjusts to match.
- Click **Generate** or press Enter in the prompt box. While running, a stopwatch shows elapsed time.
- If you close or reload mid-run, the pending items reappear as **Interrupted** with Retry/Delete buttons and non-animated placeholders.
- Switch between **Create** and **Gallery** via the floating pill at the top; it stays visible when scrolling.

## Providers
- **FAL (default):** Uses `fal-ai/gemini-3-pro-image-preview` with sync mode. Supports `output_format` (`png`, `jpeg`, `webp`), `aspect_ratio`, `resolution`, and optional image edits.
- **Gemini API:** Calls `gemini-3-pro-image-preview` directly via the Generative Language endpoint. Supply your Gemini API key in settings.

## Notes and limitations
- Everything is client-initiated; server jobs are not durable. Closing the page interrupts in-flight requests.
- Attachment and gallery data are stored locally; clear your browser storage to wipe state.
- Max four outputs per request; max eight input images (UI cap; model accepts more).

## Scripts
- `npm run dev` — start Next.js with Turbopack
- `npm run build` — production build
- `npm run lint` — ESLint
