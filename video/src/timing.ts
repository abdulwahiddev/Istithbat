import script from './script.json';
import narration from './narration.json';

export const FPS = script.fps;
export const DURATION_SEC = script.durationSec;
export const DURATION = Math.round(DURATION_SEC * FPS);
export const sec = (s: number) => Math.round(s * FPS);

export type SceneId = (typeof script.scenes)[number]['id'];
export const SCENES = script.scenes.map((s) => ({ id: s.id as SceneId, start: s.start, end: s.end, from: sec(s.start), frames: sec(s.end) - sec(s.start) }));
export const scene = (id: SceneId) => SCENES.find((s) => s.id === id)!;

export type Cue = { text: string; start: number; end: number };
/** Phrase-level captions on the absolute timeline (seconds), from scripts/tts.py. */
export const CAPTIONS: Cue[] = narration.scenes.flatMap((s) => s.sentences.flatMap((x) => x.captions));
/** Sentence start (absolute seconds) — used to sync on-screen typography to the voice. */
export const sentenceAt = (id: SceneId, i: number) => {
  const s = narration.scenes.find((x) => x.id === id)!.sentences[i];
  return { start: s.start, end: s.end };
};
/** Time (scene-relative seconds) at which a caption phrase containing `needle` begins. */
export const cueAt = (id: SceneId, needle: string) => {
  const sc = scene(id);
  const c = narration.scenes.find((x) => x.id === id)!.sentences.flatMap((x) => x.captions).find((x) => x.text.includes(needle));
  if (!c) throw new Error(`cue not found: ${needle}`);
  return c.start - sc.start;
};
