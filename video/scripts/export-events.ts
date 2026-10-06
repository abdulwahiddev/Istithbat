// Writes public/audio/events.json (sound cues + scene windows + speech intervals) for scripts/mix.py.
import { writeFileSync } from 'node:fs';
import { EVENTS } from '../src/audio/events';
import narration from '../src/narration.json';
import script from '../src/script.json';

const speech = narration.scenes.flatMap((s) => s.sentences.map((x) => [x.start, x.end]));
writeFileSync('public/audio/events.json', JSON.stringify({
  durationSec: script.durationSec,
  scenes: script.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })),
  speech, events: EVENTS,
}, null, 2) + '\n');
console.log(`exported ${EVENTS.length} sound events`);
