# Istithbat · 2-minute demo video (Remotion)

Final Islamic AI Challenge submission video. **1920×1080 · 30 fps · H.264 MP4 · 1:54 (114.0 s).**

This is a standalone project: its own `package.json` and lockfile, excluded from the app's
`tsconfig.json` and from Vercel deploys (`.vercelignore`). It never imports app code at runtime;
brand assets are copied from `public/brand` and `public/landing`, tokens from
`app/(landing)/landing.css`, icons vendored from `components/strata/icons.tsx`.

## Render

```bash
cd video && npm ci && npm run render      # → out/istithbat-demo.mp4
```

Preview / tweak live: `npm run studio`. Review stills: `node scripts/stills.mjs 27 54 93`.

## The rule this project follows

Motion graphics, typography, captions, zooms and callouts are generated. **All proof of product
behaviour comes from real Istithbat captures** dropped into the footage slots. Nothing here draws
product UI; callouts only restate the verified 10618 facts (`src/scenes/*`). Until a slot has a
capture it renders a dashed placeholder card that says so.

## Footage slots → `public/footage/<slot>/capture.mp4` (or .webm/.mov/.png/.jpg)

| Slot | Scene | Window | Must show |
|---|---|---|---|
| `01-sandbox-baseline-publish` | 3 | 0:17–0:30 | `/sandbox` clean baseline v13·v13·v13, click **Publish controlled candidate** |
| `02-pipeline` | 4 | 0:30–0:46 | Detect → Understand → Test → Trace → Contain progressing |
| `03-exact-change` | 5 | 0:46–0:57 | `ar.grade` diff, 4 words removed, `449efbaf → d3908502`, `SCHOLAR_JUDGMENT` |
| `04-regression` | 6 | 0:57–1:10 | trusted vs candidate answers, 2 MATERIAL · 1 NON-MATERIAL |
| `05-blast-radius` | 7 | 1:10–1:23 | record → … → applications, 6 EXPOSED · 1 IMPACTED · 0 STALE, Islamic Q&A IMPACTED |
| `06-gateway` | 8 | 1:23–1:36 | Latest v14 · Trusted v13 · Served v13, POL-002 → QUARANTINE |
| `07-human-review` | 9 | 1:36–1:47 | exact change, AI advisory, regression, Blast Radius, policy, decision controls |

Each slot folder has a README with its checklist. After dropping a capture, tune that slot in
`src/footage.ts`:

- `segments` — which part of the recording plays. Cut idle waits by splitting into several
  segments with `from` (source second) and `at` (scene second). Do not speed through state changes.
- `camera` — focus point and scale over time (normalised). Keep 1.00–1.04; scene 5 punches in to
  ~1.35 on the Arabic diff, so capture at 2× device scale (3840×2160) for sharp text.
- `anchors` — the UI point each callout's leader rule points at.

Captures: dark theme, 1920×1080 viewport (2× DPR ideal), steady cursor, no personal data. Use the
Preview deployment's `/sandbox`; do not reset or publish on Production without approval.

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

## Verified facts used on screen (HadeethEnc 10618)

Original `ar.grade = صحيح دون قوله: (ولم يستدر)` → controlled candidate `ar.grade = صحيح`.
Hadith text unchanged; only `ar.grade` changed; 4 words removed; fingerprints `449efbaf → d3908502`;
field role `SCHOLAR_JUDGMENT`; POL-002 → QUARANTINE; matched regression 2 MATERIAL / 1 NON-MATERIAL;
Blast Radius 6 EXPOSED / 1 IMPACTED / 0 STALE; Islamic Q&A IMPACTED; Latest v14, Trusted v13,
Served v13; AI analysis `EVIDENCE_DRIFT` (no risk level shown: it varied between runs; live AI was
Gemini `gemini-3.5-flash-lite`). The candidate was created by Istithbat for testing and was not
published by HadeethEnc. The video says so on every product scene.
