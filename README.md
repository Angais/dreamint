# Dreamint

Dreamint is a browser-based workspace for generating and editing images through [OpenRouter](https://openrouter.ai). One API key gives access to every image model in OpenRouter's catalog — pick the models you want, pin providers, tweak aspect/resolution/quality, and keep a local gallery with real cost tracking.

> WARNING: YOU USE THIS AT YOUR OWN RISK. YOU ARE RESPONSIBLE FOR ANY API COSTS, ERRORS, OR MISBEHAVIOR.

## What’s included
- Prompt composer with a model selector, aspect-ratio presets, resolution tiers (512/1K/2K/4K), quality levels, and output format selection (PNG/JPEG/WEBP) — each control adapts to what the selected model supports.
- Searchable model manager in settings: enable any OpenRouter image models; only enabled models appear in the composer.
- Per-model provider routing: pin a specific provider (e.g. Google AI Studio for BYOK). With fallbacks off, requests fail instead of routing to another provider.
- Up to eight reference images for edits; drag-and-drop, paste, or file picker.
- Batch generation (1–4 images) with local gallery, metadata chips, and one-click “Use prompt” restore.
- Budget tracking based on the real per-generation cost OpenRouter reports, including upstream BYOK costs.
- Lightbox with keyboard/scroll navigation, download in your selected format, and edit-from-image shortcut.
- Interrupted request recovery: pending jobs saved locally are marked “Interrupted” after reload/close with Retry/Delete options.
- Local-first state: prompts/settings in `localStorage`; gallery and pending items in IndexedDB via `localforage`. The API key stays in the browser only.

## Requirements
- Node.js 18+
- An [OpenRouter API key](https://openrouter.ai/keys). It is supplied in-app and stays in your browser; it is not stored on the server.

## Setup
```bash
npm install
```

## Running locally
1) Start dev server:
```bash
npm run dev
```
2) Open http://localhost:3000
3) Open Settings, add your OpenRouter API key, and enable the models you want to use.

## Access protection (optional)
- Set `ACCESS_PASSWORD` in your deploy environment to require a one-time password on first visit.
- Successful unlock sets a signed, HttpOnly session cookie (30-day TTL, auto-refresh) and enforces a 5-try lockout (10 minutes) on failures.
- If `ACCESS_PASSWORD` is unset, the gate is disabled.

## Using the app
- Pick a model, aspect, resolution, quality, and **Output Format** from the control bar; unavailable controls hide automatically per model.
- Add reference images (max 8, capped by what the model accepts). The aspect switches to Auto to follow the first reference.
- Click **Generate** or press Enter in the prompt box. While running, a stopwatch shows elapsed time.
- If you close or reload mid-run, the pending items reappear as **Interrupted** with Retry/Delete buttons.
- Switch between **Create** and **Gallery** via the floating pill at the top.

## Provider routing and BYOK
Each enabled model's settings row lists the providers OpenRouter can route it to. Pinning a provider sends every request for that model there. Leave **Allow fallbacks** off to make requests fail rather than fall back to another provider — useful when you have BYOK configured in OpenRouter for a specific provider and don't want silent rerouting.

## Notes and limitations
- Everything is client-initiated; server jobs are not durable. Closing the page interrupts in-flight requests.
- The server only proxies requests to OpenRouter (and serves the optional password gate); your key is forwarded per-request and never stored.
- Attachment, gallery, and API key state are stored locally in your browser; clear your browser storage to wipe state.
- Max four outputs per request in the UI; models that only support one image per call are batched transparently.

## Scripts
- `npm run dev` — start Next.js with Turbopack
- `npm run build` — production build
- `npm run lint` — ESLint
