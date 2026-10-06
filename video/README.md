# Istithbat · 2-minute demo video (Remotion)

Final Islamic AI Challenge submission video. **1920×1080 · 30 fps · H.264 MP4 · 1:54 (114.0 s).**

This is a standalone project: its own `package.json` and lockfile, excluded from the app's
`tsconfig.json` and from Vercel deploys (`.vercelignore`). It changes no app code: it *imports* the
product's components, engines and stylesheets read-only (`@/` → repo root) so the film shows the real
UI. Brand assets are copied from `public/brand` and `public/landing`; landing tokens from
`app/(landing)/landing.css`. Run all commands from `video/`.

## Render

```bash
cd video && npm ci && npm run render      # → out/istithbat-demo.mp4
```

Preview / tweak live: `npm run studio`. Review stills: `node scripts/stills.mjs 27 54 93`.

## How the film is built

**0:00–0:17** brand open (landing trust-stack plate, serving-state statement).
**0:17–1:47** one continuous camera through the product (`src/journey/`):

`Publish → Detect → Understand → Test → Trace → Contain → Human decision`

- **Publish** is the only literal screen recording: the real Production `/sandbox` publish action
  (slot below). It establishes authenticity.
- Everything after the click is **choreographed in Remotion from verified Production state, rendered
  with the product's own code**: `ExactDiff`, `GateInstrument`, `DecisionDock`, the Blast Radius
  layout engine (`components/blast/layout.ts`), the sandbox pipeline markup, `semantics.ts` labels and
  the app's own Strata stylesheets, imported directly from the repo (see `webpack-override.mjs`). The
  product's reduced-motion rule is applied so components render their true settled state; all motion
  is frame-driven.
- Stages sit along one world; the camera travels between them (expo in/out, slight pull-back, motion
  blur). The **v14 candidate** rides the pipeline, docks in the live serving readout, and later drops
  into the Trust Gateway; each stage's verified result (exact change, 3/3 material, 6·1·0, POL-002)
  is **carried** into an evidence tray and assembled beside the decision dock.
- The run took several minutes; waiting time is cut and labelled *Production run · waiting time removed*.

**1:47–1:54** brand close.

## Verified data — `src/data/production.ts`

The only state the film shows. Values come from the product where it holds them (the sandbox scenario
contract, the diff engine, policy table, governance transitions, the Production asset graph from
`db/seed/index.ts`) and from the verified Production results otherwise. Guards fail the render if a
derived fact disagrees (4 words removed, 6 EXPOSED / 1 IMPACTED / 0 STALE, POL-002 floor, 3/0).

| Fact | Value |
|---|---|
| Record | HadeethEnc 10618 (`SANDBOX-HENC-10618`) |
| Exact change | `ar.grade`: `صحيح دون قوله: (ولم يستدر)` → `صحيح`, 4 words removed |
| Fingerprint | `449efbaf → d3908502` · field role `SCHOLAR_JUDGMENT` |
| Regression | 3 MATERIAL / 0 NON-MATERIAL (answer texts are not shown) |
| Blast Radius | 6 EXPOSED / 1 IMPACTED / 0 STALE · Islamic Q&A IMPACTED |
| Policy | POL-002 → QUARANTINE |
| Serving | Latest v14 · Trusted v13 · Served v13 |
| Decision | none recorded — the dock is shown in its signed-out preview state |

No AI label or risk level is shown (AI output varied between runs and is not part of the verified
Production list). The candidate was created by Istithbat for testing and was not published by
HadeethEnc; the film says so on every product frame.

## The one recording → `public/footage/01-sandbox-baseline-publish/capture.mp4`

Must show: clean baseline (upstream/trusted/served v13, "Ready to run"), the operator clicking
**Publish controlled candidate**, and the run starting. 1920×1080 (2× DPR ideal), dark theme, steady
cursor, ~13 s. Until it exists, a dashed placeholder card stands in. After dropping it, set
`SANDBOX.anchors.publish` in `src/footage.ts` to where the button is (the v14 candidate emerges
there), and optionally trim with `segments`.

## Narration & captions

`src/script.json` is the single source of truth for scene windows, narration and caption phrases.

```bash
pip install kokoro-onnx soundfile
# model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
KOKORO_DIR=/path/to/models npm run narration   # → public/audio/voiceover.wav + src/narration.json
```

The included `voiceover.wav` is neutral synthetic narration (Kokoro-82M, voice `af_heart`,
Apache-2.0), loudness-normalised to about −16 LUFS. Captions are phrase-level and timed from it.
Pronunciation overrides (Istithbat, Hadeeth, `10618`, `POL-002`) are in `scripts/tts.py`.

**Replacing the voice:** drop a new `public/audio/voiceover.wav` (114 s) whose sentences start at the
times in `src/narration.json`. Or edit `src/script.json` and re-run `npm run narration`; captions
and on-screen sync follow automatically.

## Music

`public/audio/music.mp3` is a generated, quiet modal pad (`npm run music`, no drums or risers),
mixed at ~−24 dB under the voice (`MUSIC_GAIN` in `src/Video.tsx`). Replace it with any licensed
instrumental of 114 s or longer; no code changes needed.
