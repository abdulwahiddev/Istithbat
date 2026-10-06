/**
 * Sound-design cue sheet. Every time here is computed from the SAME expressions the visuals use
 * (narration cues, stages.ts DONE_AT/RUN_AT/PRESS_AT, and the panels' own reveal formulas), so
 * each sound lands on its visual event. `npm run audio` exports this and builds the final mix.
 * Keep in step with: PublishPanel, PipelinePanel, DetectPanel, TestPanel, TracePanel,
 * ContainPanel, HumanPanel and Carry.tsx.
 */
import { scene, sentenceAt } from '../timing';
import { cue, DONE_AT, PRESS_AT, RUN_AT } from '../journey/stages';

export type Sfx = 'click' | 'rise' | 'tick' | 'texture' | 'confirm' | 'accent' | 'land' | 'lock' | 'node' | 'pulse' | 'impact' | 'low' | 'flow' | 'arrive' | 'resolve';
export type Ev = { t: number; sfx: Sfx; gain?: number; pitch?: number; pan?: number; note: string };

const S = (id: Parameters<typeof scene>[0]) => scene(id).start;
const E: Ev[] = [];
const add = (t: number, sfx: Sfx, note: string, o: Partial<Ev> = {}) => E.push({ t, sfx, note, ...o });

// Publish — the operator's press, the candidate entering the run
add(PRESS_AT + 0.06, 'click', 'Publish controlled candidate pressed');
add(DONE_AT.publish, 'rise', 'v14 candidate introduced', { gain: 0.8 });
add(RUN_AT.detect + 0.1, 'rise', 'v14 enters the pipeline (Detect)', { gain: 0.6, pitch: 1.12 });

// Pipeline — each persisted stage completes (time-compressed run)
(['detect', 'understand', 'test', 'trace', 'contain'] as const).forEach((k, i) => add(DONE_AT[k], 'tick', `${k} done`, { pitch: 1 + i * 0.09, gain: 0.7 }));
add(RUN_AT.understand + 0.1, 'texture', 'Understand: analytical texture (no sparkle)', { gain: 0.55 });

// Detect — exact change resolves; the removed words become evidence
const tField = cue('s05-exact-change', 'Only the grading field'), tGone = cue('s05-exact-change', 'an explicit exception');
add(tField + 1.1, 'confirm', 'diff resolves (candidate row revealed)');
add(tGone + 0.6, 'tick', 'fingerprint 449efbaf → d3908502 resolves', { pitch: 1.3, gain: 0.55 });
add(S('s06-regression') - 1.3, 'accent', '4 words removed lifts into evidence', { gain: 0.75 });
add(S('s06-regression') - 0.2, 'land', 'evidence lands in tray');

// Test — three comparisons lock to MATERIAL, then the tally
const tAll = cue('s06-regression', 'All three');
[0, 1, 2].forEach((i) => add(tAll + 0.25 + i * 0.35 + 0.15, 'lock', `comparison ${i + 1} MATERIAL`, { pitch: 1 + i * 0.06, gain: 0.7, pan: -0.3 + i * 0.3 }));
add(tAll + 1.4, 'accent', '3 MATERIAL · 0 NON-MATERIAL resolves', { pitch: 1.12 });
add(S('s07-blast-radius') - 0.2, 'land', 'regression evidence lands in tray');

// Trace — the radius propagates column by column (richest moment)
const s0 = sentenceAt('s07-blast-radius', 0);
const depthAt = (d: number) => s0.start + 0.1 + (d * (s0.end - s0.start + 0.4)) / 7; // = TracePanel.depthAt
add(depthAt(0), 'pulse', 'trace begins at the source', { gain: 0.7, pan: -0.6 });
for (let d = 0; d < 7; d++) add(depthAt(d) + 0.05, 'node', `depth ${d} surfaces`, { pitch: [1, 1.122, 1.26, 1.498, 1.682, 2, 2.245][d], pan: -0.7 + d * 0.23, gain: 0.55 + d * 0.04 });
add(cue('s07-blast-radius', 'Six downstream') + 0.1, 'pulse', 'tally fills (6 exposed)', { gain: 0.55, pan: 0.2 });
add(cue('s07-blast-radius', 'and one protected') - 0.45, 'pulse', 'regression evidence links to Islamic Q&A', { gain: 0.6, pan: 0.5 });
add(cue('s07-blast-radius', 'and one protected') + 0.2, 'impact', 'Islamic Q&A becomes IMPACTED', { gain: 0.95, pan: 0.35 });
add(S('s08-gateway') - 0.2, 'land', 'blast evidence lands in tray');

// Contain — v14 stopped by POL-002, QUARANTINED, v13 keeps flowing
const tPol = cue('s08-gateway', 'POL-002 quarantines'), tServe = cue('s08-gateway', 'while the previous trusted');
add(tPol - 1.15, 'land', 'v14 arrives at the gate', { pan: -0.4 });
add(tPol, 'lock', 'POL-002 stops v14 at the gate', { gain: 1.0, pitch: 0.82 });
add(tPol + 0.7, 'low', 'QUARANTINED resolves', { gain: 0.9 });
add(tServe + 0.3, 'flow', 'v13 continues to Served (turquoise path)', { gain: 0.8 });
add(S('s09-human-review') - 0.2, 'land', 'policy evidence lands in tray');

// Human decision — evidence gathers; NO decision sound (none was recorded)
[1.4, 1.8, 2.2, 2.6].forEach((dt, i) => add(S('s09-human-review') + dt, 'arrive', `evidence ${i + 1} arrives at the dock`, { pitch: 1 + i * 0.06, gain: 0.6 }));

// Close
add(S('s10-close') + 0.15, 'resolve', 'brand resolve');

export const EVENTS = E.sort((a, b) => a.t - b.t);
