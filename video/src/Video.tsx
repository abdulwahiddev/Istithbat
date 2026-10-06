import type React from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile } from 'remotion';
import { C } from './brand';
import { Captions } from './components/Captions';
import { S01Hook } from './scenes/S01Hook';
import { S02TrustState } from './scenes/S02TrustState';
import { S03Publish } from './scenes/S03Publish';
import { S04Pipeline } from './scenes/S04Pipeline';
import { S05ExactChange } from './scenes/S05ExactChange';
import { S06Regression } from './scenes/S06Regression';
import { S07BlastRadius } from './scenes/S07BlastRadius';
import { S08Gateway } from './scenes/S08Gateway';
import { S09HumanReview } from './scenes/S09HumanReview';
import { S10Close } from './scenes/S10Close';
import { DURATION, FPS, SCENES, type SceneId } from './timing';

const VIEWS: Record<SceneId, () => React.JSX.Element> = {
  's01-hook': S01Hook, 's02-trust-state': S02TrustState, 's03-publish': S03Publish, 's04-pipeline': S04Pipeline,
  's05-exact-change': S05ExactChange, 's06-regression': S06Regression, 's07-blast-radius': S07BlastRadius,
  's08-gateway': S08Gateway, 's09-human-review': S09HumanReview, 's10-close': S10Close,
};

// Music sits far under the voice (~ -24 dB relative) and fades in/out; narration is unprocessed.
const MUSIC_GAIN = 0.07;

export function IstithbatDemo() {
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      {SCENES.map((s) => {
        const View = VIEWS[s.id];
        return <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.frames}><View /></Sequence>;
      })}
      <Captions />
      <Html5Audio src={staticFile('audio/voiceover.wav')} volume={1} />
      <Html5Audio src={staticFile('audio/music.mp3')}
        volume={(f) => MUSIC_GAIN * interpolate(f, [0, FPS * 1.5, DURATION - FPS * 4, DURATION], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    </AbsoluteFill>
  );
}
