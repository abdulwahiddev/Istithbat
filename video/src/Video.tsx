import { AbsoluteFill, Html5Audio, Sequence, staticFile } from 'remotion';
import { C } from './brand';
import { Captions } from './components/Captions';
import { S01Hook } from './scenes/S01Hook';
import { S02TrustState } from './scenes/S02TrustState';
import { S10Close } from './scenes/S10Close';
import { Journey } from './journey/Journey';
import { scene } from './timing';


export function IstithbatDemo() {
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <Sequence name="s01-hook" from={scene('s01-hook').from} durationInFrames={scene('s01-hook').frames}><S01Hook /></Sequence>
      <Sequence name="s02-trust-state" from={scene('s02-trust-state').from} durationInFrames={scene('s02-trust-state').frames}><S02TrustState /></Sequence>
      {/* 0:17–1:47 one continuous path through the product */}
      <Sequence name="journey" from={scene('s03-publish').from} durationInFrames={scene('s09-human-review').from + scene('s09-human-review').frames - scene('s03-publish').from}><Journey /></Sequence>
      <Sequence name="s10-close" from={scene('s10-close').from} durationInFrames={scene('s10-close').frames}><S10Close /></Sequence>
      <Captions />
      {/* final master: narration + score (ducked under speech) + sound design, built by `npm run audio` */}
      <Html5Audio src={staticFile('audio/mix.wav')} volume={1} />
    </AbsoluteFill>
  );
}
