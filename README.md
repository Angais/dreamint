# Dreamint

Dreamint is a browser-based workspace for generating images with Seedream 4.0 using FAL. It streamlines prompt crafting, parameter tweaks, and gallery review so you can experiment quickly without setup overhead.

WARNING: EVERYTHING YOU DO IS UNDER YOUR OWN RESPONSIBILITY. I AM NOT RESPONSIBLE FOR ANYTHING THAT HAPPENS (UNEXPECTED API USAGE, MALFUNCTIONING OF THE API, ETC.).

## Installation

1. Ensure Node.js 18+ is installed.
2. Install dependencies with `npm install` (or `pnpm install` / `yarn install`).

## Running Locally

1. Provide your `FAL_API_KEY` either by adding it to `.env.local` **or** by entering it through the in-app Settings button once Dreamint is running.
2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to launch Dreamint.

## Features

- **Prompt workspace:** pair your description with aspect presets, quality levels, optional seed input, and size overrides.
- **Custom dimensions:** specify exact width and height when you need a bespoke resolution.
- **Reference images:** upload up to four guidance images.
- **Batch generation:** request four variations per run, download outputs instantly, or queue edits from the history sidebar.
- **Interactive gallery:** revisit past generations, inspect metadata chips, and restore settings for new runs.
- **Lightbox viewer:** review images fullscreen with keyboard arrows, overlay buttons, or scroll gestures; download or jump into editing without closing the view.