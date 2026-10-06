import { Composition } from 'remotion';
import { IstithbatDemo } from './Video';
import { DURATION, FPS } from './timing';

export function RemotionRoot() {
  return <Composition id="IstithbatDemo" component={IstithbatDemo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />;
}
