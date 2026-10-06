import { cueAt, scene, type SceneId } from '../timing';

/**
 * The one continuous path: Publish → Detect → Understand → Test → Trace → Contain → Human decision.
 * Each inspected stage is a real product surface placed along a horizontal world; the camera travels
 * between them. World units are product CSS px; `s` is the camera scale while the stage is in view.
 */
export const J0 = scene('s03-publish').start; // journey starts at 0:17 (absolute seconds)

export type StageId = 'publish' | 'pipeline' | 'detect' | 'test' | 'trace' | 'contain' | 'human';
export type Stage = { id: StageId; scene: SceneId; x: number; w: number; h: number; s: number; dy?: number };

const GAP = 2200;
export const STAGES: Stage[] = [
  { id: 'publish', scene: 's03-publish', x: 0 * GAP, w: 1280, h: 780, s: 0.95 },
  { id: 'pipeline', scene: 's04-pipeline', x: 1 * GAP, w: 1240, h: 340, s: 1.32 },
  { id: 'detect', scene: 's05-exact-change', x: 2 * GAP, w: 1240, h: 600, s: 1.18 },
  { id: 'test', scene: 's06-regression', x: 3 * GAP, w: 1240, h: 600, s: 1.18 },
  { id: 'trace', scene: 's07-blast-radius', x: 4 * GAP, w: 1400, h: 600, s: 1.12 },
  { id: 'contain', scene: 's08-gateway', x: 5 * GAP, w: 1240, h: 640, s: 1.12 },
  { id: 'human', scene: 's09-human-review', x: 6 * GAP, w: 1560, h: 700, s: 0.94 },
];
export const stage = (id: StageId) => STAGES.find((s) => s.id === id)!;

/** Absolute second of a narration phrase (for syncing anything in the journey to the voice). */
export const cue = (id: SceneId, needle: string) => scene(id).start + cueAt(id, needle);
/** Journey-relative seconds from absolute seconds. */
export const jt = (abs: number) => abs - J0;

/** The rail the viewer travels along (HUD), with the stage each item belongs to. */
export const RAIL = [
  { key: 'publish', label: 'Publish', layer: 'src' },
  { key: 'detect', label: 'Detect', layer: 'det' },
  { key: 'understand', label: 'Understand', layer: 'ai' },
  { key: 'test', label: 'Test', layer: 'det' },
  { key: 'trace', label: 'Trace', layer: 'det' },
  { key: 'contain', label: 'Contain', layer: 'pol' },
  { key: 'human', label: 'Human decision', layer: 'hum' },
] as const;

/** The operator presses "Publish controlled candidate" as the narration says "publish". */
export const PRESS_AT = cue('s03-publish', 'and publish one known mutation') + 0.25;

/** When each pipeline stage completes in the (time-compressed) Production run, synced to the voice. */
export const DONE_AT = {
  publish: PRESS_AT + 1.1, // console leaves its busy state; the candidate enters the pipeline
  detect: cue('s04-pipeline', 'analyzes its semantic'),
  understand: cue('s04-pipeline', 'runs matched'),
  test: cue('s04-pipeline', 'traces downstream'),
  trace: cue('s04-pipeline', 'evaluates deterministic'),
  contain: scene('s04-pipeline').end - 1.0,
} as const;
export const RUN_AT = {
  detect: scene('s04-pipeline').start + 0.35,
  understand: DONE_AT.detect, test: DONE_AT.understand, trace: DONE_AT.test, contain: DONE_AT.trace,
} as const;
