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

- **Publish** renders the `/sandbox` operator console from its own markup (see below), including
  the press of *Publish controlled candidate*.
- Every stage is **choreographed in Remotion from verified Production state, rendered
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

## Publish (0:17–0:30)

`src/journey/panels/PublishPanel.tsx` reproduces the `/sandbox` operator console from its own
markup and copy (`SandboxConsole` + `SandboxBar`). It runs on the video clock instead of fetching
from the API:
- the verified baseline: Latest v13 · Trusted v13 · Served v13, *Ready to run*, demo control active,
  HadeethEnc 10618 disclosure;
- a pointer, then the button's pressed and busy state (*Publishing…*);
- then *Processing* and the console's real notice.

v14 comes out of the button and is carried into Detect. No screen recording and no Production call
are involved.

## Narration & captions

`src/script.json` is the single source of truth for scene windows, narration and caption phrases.
`npm run narration` (Kokoro-82M via kokoro-onnx, offline; set `KOKORO_DIR` to the model files from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) writes
`public/audio/voiceover.wav` and `src/narration.json`. Captions and on-screen sync follow
automatically.

- **Voice:** Kokoro `am_michael`, an adult male with a calm, documentary delivery. It was picked from
  an audition of ten male voices transcribed by Whisper-small; all ten were 100% intelligible.
- **Istithbat (استثبات):** spoken from the explicit IPA `istiθbˈaːt`, which follows the Arabic sounds
  one for one: i‑s‑t‑i‑θ‑b‑aː‑t. That gives a real *th* (ث), a clear *b*, a long final *ā*, and
  stress on the final long syllable. The same voice says it inside the same sentence, so there is no
  splice. English TTS on its own said "Istithbat" or "Istif bot".
- **Arabic words:** hadith and HadeethEnc are spoken ha‑DEETH (`hɐdˈiːθ`). Bilāl and Qur'an are
  not spoken.
- All pronunciation overrides are in `scripts/tts.py`.

## Audio — `npm run audio`

1. `tsx scripts/export-events.ts` exports the sound cue sheet from `src/audio/events.ts`. Every cue
   uses the same timing as the visual it belongs to, so each sound lands on its event.
2. `scripts/music.py` writes the score to `public/audio/music.wav`: D minor, 96 BPM, no drums or
   trailer hits. The arc:
   - slight tension in the opening;
   - momentum through Detect and Test;
   - a lift through Blast Radius → Contain;
   - resolved and minimal at Human decision and the close.
3. `scripts/mix.py` synthesizes the sound-effects stem (`sfx.wav`) and masters
   `public/audio/mix.wav`, the only audio file the composition plays:
   - music sits 14 LU under the voice while it speaks, ducked about 5 dB (120 ms attack, 600 ms
     release), and comes back up in gaps and over the final logo;
   - sound effects sit about 12 LU under the voice;
   - the master is −15 LUFS with true peak at or below −1.5 dBTP.
   - There is deliberately no decision sound, because no human decision was recorded.

To use a licensed score instead, replace `public/audio/music.wav` and run `npm run audio`.

