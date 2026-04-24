# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build (output: dist/)
npm run preview    # Preview production build
npm run lint       # Type-check only (tsc --noEmit) — no test suite exists
npm run clean      # Remove dist/
```

## Environment

Create a `.env.local` file at the project root with:

```
GEMINI_API_KEY=your_key_here
```

The Vite config inlines `GEMINI_API_KEY` into the client bundle via `process.env.GEMINI_API_KEY`. The `.env.example` file was deleted from tracking — use `.env.local`.

## Architecture

Single-page React app (no router, no backend server). All logic lives in two files:

- [src/App.tsx](src/App.tsx) — entire UI: camera capture, file upload, image preview with bounding-box overlay, swipe-card review flow, and summary screen.
- [src/services/geminiService.ts](src/services/geminiService.ts) — calls the Gemini API (`gemini-3.1-pro-preview`) with a structured JSON schema. Returns `ToyAnalysisResult[]`, each with `name`, `category`, `description`, `confidence`, `box2d` (normalized `[ymin, xmin, ymax, xmax]`), and `priceMin`/`priceMax` (CAD).

**Data flow:**
1. User captures or uploads an image → stored as a base64 data URL in state.
2. `analyzeToys()` sends the base64 payload to Gemini and parses the structured JSON response.
3. Results are sorted top-to-bottom, left-to-right by `box2d[0]` (ymin) with a 0.15 row-threshold.
4. App renders a swipe-card UI (Framer Motion drag) per toy; the highlighted bounding box on the image tracks `currentIndex`.
5. After all cards are reviewed, a summary list shows each toy with its keep/discard decision.

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js` — configuration is inline).

**Animations:** `motion/react` (Framer Motion v12) used for card entrance/exit/drag and bounding-box highlight.

The app is French-language: all UI text and Gemini prompts/responses are in French.
