/**
 * REAL FOOTAGE SLOTS — the only place product proof enters the video.
 *
 * Drop real Istithbat captures into public/footage/<slot>/ using the file names below.
 * A slot renders its capture when the file exists, otherwise a clearly-labelled placeholder.
 * Nothing in this project draws product UI: callouts only restate the verified 10618 facts.
 *
 * Coordinates are normalised to the footage frame (0..1). After dropping a capture, tune:
 *  - `segments`  which part of the recording plays (skip idle waits with `from` / `rate`)
 *  - `camera`    focus point + scale over time (keep 1.00–1.04 except where noted)
 *  - `anchors`   where callout leader lines point (the UI element they describe)
 * Preview with `npm run studio`, then `npm run render`.
 */
export type Segment = {
  /** base name inside public/footage/<slot>/; resolved as .mp4, .webm, .mov, .png or .jpg (or give the extension) */
  file: string;
  /** scene-relative second at which this segment starts showing */
  at: number;
  /** second within the source video to start from */
  from?: number;
  /** playback rate (e.g. 2 to compress a wait — never use to fake state changes) */
  rate?: number;
};
export type CamKey = { t: number; x: number; y: number; s: number };
export type Pt = { x: number; y: number };

export type Slot = {
  id: string;
  title: string;
  route: string;
  /** what the real capture must visibly prove (also printed on the placeholder) */
  mustShow: string[];
  segments: Segment[];
  camera: CamKey[];
  anchors: Record<string, Pt>;
};

/** default: one capture per slot, any supported extension (capture.mp4 / .webm / .mov / .png / .jpg) */
const capture = (): Segment[] => [{ file: 'capture', at: 0 }];

export const SLOTS = {
  sandbox: {
    id: '01-sandbox-baseline-publish', title: 'Sandbox · clean baseline, then publish', route: '/sandbox',
    mustShow: [
      'Clean baseline: Latest v13 · Trusted v13 · Served v13',
      'Operator clicks “Publish controlled candidate”',
      'Record HadeethEnc 10618 visible',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.5, y: 0.5, s: 1 }, { t: 6.5, x: 0.5, y: 0.45, s: 1.0 }, { t: 9.5, x: 0.62, y: 0.5, s: 1.035 }, { t: 13, x: 0.62, y: 0.5, s: 1.04 }],
    anchors: { baseline: { x: 0.3, y: 0.24 }, publish: { x: 0.74, y: 0.42 } },
  },
  pipeline: {
    id: '02-pipeline', title: 'Pipeline · Detect → Understand → Test → Trace → Contain', route: '/sandbox',
    mustShow: [
      'Pipeline stages progressing: Detect → Understand → Test → Trace → Contain',
      'Snapshot / fingerprint, exact change, semantic analysis, regression, blast radius, policy',
      'Trim idle waits with segments (do not speed through state changes)',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.2, y: 0.5, s: 1.03 }, { t: 15.5, x: 0.8, y: 0.5, s: 1.03 }, { t: 16, x: 0.8, y: 0.5, s: 1.03 }],
    anchors: {},
  },
  exact: {
    id: '03-exact-change', title: 'Exact change · ar.grade', route: '/incidents/<id> or /sandbox evidence',
    mustShow: [
      'ar.grade: صحيح دون قوله: (ولم يستدر) → صحيح',
      'Hadith text unchanged · only ar.grade changed · 4 words removed',
      'Fingerprints 449efbaf → d3908502 · field role SCHOLAR_JUDGMENT',
      'Capture at 2× device scale so the Arabic stays sharp when zoomed',
    ],
    segments: capture(),
    // punch-in on the diff when the grading field is named (the one larger zoom in the film)
    camera: [{ t: 0, x: 0.5, y: 0.5, s: 1.0 }, { t: 2.6, x: 0.5, y: 0.45, s: 1.02 }, { t: 3.6, x: 0.45, y: 0.42, s: 1.35 }, { t: 11, x: 0.45, y: 0.42, s: 1.38 }],
    anchors: { diff: { x: 0.45, y: 0.42 } },
  },
  regression: {
    id: '04-regression', title: 'Matched regression · trusted vs candidate', route: '/incidents/<id> (Behavior)',
    mustShow: [
      'Trusted (v13) and candidate (v14) answer panels side by side',
      'Same model · same prompt · same settings',
      'Result: 2 MATERIAL · 1 NON-MATERIAL',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.3, y: 0.5, s: 1.03 }, { t: 5.5, x: 0.7, y: 0.5, s: 1.03 }, { t: 9, x: 0.5, y: 0.5, s: 1.0 }, { t: 13, x: 0.5, y: 0.5, s: 1.0 }],
    anchors: { trusted: { x: 0.27, y: 0.5 }, candidate: { x: 0.73, y: 0.5 }, verdict: { x: 0.5, y: 0.2 } },
  },
  blast: {
    id: '05-blast-radius', title: 'Blast Radius · record → applications', route: '/incidents/<id> (Blast Radius)',
    mustShow: [
      'Trace: record → dataset → chunk → index → APIs → applications',
      'Tally: 6 EXPOSED · 1 IMPACTED · 0 STALE',
      'Islamic Q&A (protected) = IMPACTED',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.15, y: 0.5, s: 1.04 }, { t: 8.5, x: 0.85, y: 0.5, s: 1.04 }, { t: 10, x: 0.5, y: 0.5, s: 1.0 }, { t: 13, x: 0.5, y: 0.5, s: 1.0 }],
    anchors: { qa: { x: 0.86, y: 0.55 } },
  },
  gateway: {
    id: '06-gateway', title: 'Trust Gateway · containment', route: '/gateway',
    mustShow: [
      'Latest v14 · Trusted v13 · Served v13',
      'POL-002 → QUARANTINE',
      'Previous trusted version continues serving',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.5, y: 0.5, s: 1.0 }, { t: 13, x: 0.55, y: 0.48, s: 1.035 }],
    anchors: { gate: { x: 0.58, y: 0.42 } },
  },
  review: {
    id: '07-human-review', title: 'Human review · every evidence layer', route: '/incidents/<id>',
    mustShow: [
      'Exact change · AI advisory (EVIDENCE_DRIFT) · regression · Blast Radius · policy',
      'Human decision controls (no automatic promotion)',
    ],
    segments: capture(),
    camera: [{ t: 0, x: 0.5, y: 0.3, s: 1.03 }, { t: 6.5, x: 0.5, y: 0.7, s: 1.03 }, { t: 11, x: 0.5, y: 0.72, s: 1.03 }],
    anchors: {},
  },
} satisfies Record<string, Slot>;
export type SlotKey = keyof typeof SLOTS;
