import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, type Layer } from '../brand';
import type { Slot } from '../footage';
import { FPS } from '../timing';
import { prog } from './anim';
import { BandTags } from './BandTags';
import { FootageSlot, type Rect } from './FootageSlot';
import { FRAME } from './layout';

/** Standard product-footage scene: framed capture + callouts, chapter/disclosure tags, soft cut. */
export function FootageScene({ n, chapter, layer, slot, frames, rect = FRAME, overlay, children }: {
  n: string; chapter: string; layer: Layer; slot: Slot; frames: number; rect?: Rect;
  /** callouts inside the footage frame */ children?: ReactNode;
  /** full-canvas extras outside the frame */ overlay?: ReactNode;
}) {
  const frame = useCurrentFrame();
  const p = Math.min(prog(frame, 0, 0.3), 1 - prog(frame, frames / FPS - 0.25, 0.25));
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <AbsoluteFill style={{ opacity: p }}>
        <FootageSlot slot={slot} frames={frames} rect={rect}>{children}</FootageSlot>
        {overlay}
      </AbsoluteFill>
      <BandTags n={n} chapter={chapter} layer={layer} />
    </AbsoluteFill>
  );
}
