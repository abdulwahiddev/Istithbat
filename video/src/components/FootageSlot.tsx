import type { ReactNode } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, getStaticFiles, staticFile, useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import type { Slot } from '../footage';
import { FPS } from '../timing';
import { keyed } from './anim';
import { Icon } from './Icon';
import { FRAME } from './layout';

const EXT = ['.mp4', '.webm', '.mov', '.png', '.jpg', '.jpeg'];
const isVideo = (f: string) => /\.(mp4|webm|mov)$/i.test(f);

/** Resolve a segment's base name against public/ (what was bundled at render time). */
function resolve(slot: Slot, file: string): string | null {
  const names = new Set(getStaticFiles().map((f) => f.name));
  const base = `footage/${slot.id}/${file}`;
  if (/\.[a-z0-9]+$/i.test(file)) return names.has(base) ? base : null;
  for (const e of EXT) if (names.has(base + e)) return base + e;
  return null;
}

export type Rect = { x: number; y: number; w: number; h: number; r?: number };

/**
 * A window onto real product footage. Plays the slot's capture (with the configured camera) when
 * present; otherwise shows an unmistakable placeholder card. `children` are overlays in frame
 * coordinates (callouts), unaffected by the camera.
 */
export function FootageSlot({ slot, frames, rect = FRAME, children }: { slot: Slot; frames: number; rect?: Rect; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const segs = slot.segments.map((s, i) => ({ ...s, src: resolve(slot, s.file), next: slot.segments[i + 1]?.at }));
  const present = segs.some((s) => s.src);
  const cx = keyed(frame, slot.camera.map((k) => ({ t: k.t, v: k.x })));
  const cy = keyed(frame, slot.camera.map((k) => ({ t: k.t, v: k.y })));
  const cs = keyed(frame, slot.camera.map((k) => ({ t: k.t, v: k.s })));
  return (
    <div style={{
      position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r ?? FRAME.r,
      overflow: 'hidden', background: C.well, border: `1px solid ${C.line2}`,
      boxShadow: '0 30px 60px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.04)',
    }}>
      {present ? (
        <AbsoluteFill style={{ transform: `scale(${cs})`, transformOrigin: `${cx * 100}% ${cy * 100}%` }}>
          {segs.map((s, i) => {
            if (!s.src) return null;
            const from = Math.round(s.at * FPS);
            const dur = Math.max(1, Math.round(((s.next ?? frames / FPS) - s.at) * FPS));
            return (
              <Sequence key={i} from={from} durationInFrames={dur} layout="none">
                {isVideo(s.src)
                  ? <OffthreadVideo src={staticFile(s.src)} muted startFrom={Math.round((s.from ?? 0) * FPS)} playbackRate={s.rate ?? 1}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Img src={staticFile(s.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              </Sequence>
            );
          })}
        </AbsoluteFill>
      ) : <Placeholder slot={slot} frames={frames} rect={rect} />}
      <AbsoluteFill>{children}</AbsoluteFill>
    </div>
  );
}

/** Wrap Arabic runs in <bdi dir="rtl"> so mixed Latin/Arabic checklist lines keep their order. */
function Bidi({ text }: { text: string }) {
  const parts = text.split(/([؀-ۿ][؀-ۿ\s:()]*[؀-ۿ)])/g);
  return <>{parts.map((p, i) => (i % 2 ? <bdi key={i} dir="rtl" style={{ fontFamily: F.ar, fontSize: '1.08em' }}>{p}</bdi> : <span key={i}>{p}</span>))}</>;
}

function Placeholder({ slot, frames, rect }: { slot: Slot; frames: number; rect: Rect }) {
  const compact = rect.w < 1200;
  return (
    <AbsoluteFill style={{
      background: `repeating-linear-gradient(135deg, rgba(240,242,246,.025) 0 2px, transparent 2px 22px), ${C.well}`,
      fontFamily: F.sans, color: C.ink,
    }}>
      <div style={{ position: 'absolute', inset: 16, border: `2px dashed ${C.line2}`, borderRadius: 12 }} />
      {/* kept in the middle band: the top and bottom of the frame are where callouts sit */}
      <div style={{ position: 'absolute', left: compact ? 44 : 96, width: compact ? rect.w - 88 : 900, top: compact ? 44 : 280, display: 'flex', flexDirection: 'column', gap: compact ? 12 : 16 }}>
        <div style={{ font: `500 ${compact ? 14 : 17}px/22px ${F.mono}`, color: C.amInk }}>
          FOOTAGE SLOT · {slot.id} <span style={{ color: C.ink4 }}>· {(frames / FPS).toFixed(1)} s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, font: `500 ${compact ? 16 : 19}px/24px ${F.sans}`, color: C.ink3 }}>
          <span style={{ width: 22, height: 3, background: C.am, borderRadius: 1 }} />Real Istithbat capture required · placeholder, not product UI
        </div>
        <div style={{ font: `600 ${compact ? 30 : 42}px/1.12 ${F.sans}`, letterSpacing: '-0.03em', textWrap: 'balance' as never }}>{slot.title}</div>
        <div style={{ font: `400 ${compact ? 14 : 17}px/24px ${F.mono}`, color: C.ink3 }}>
          route {slot.route}<br /><span style={{ color: C.ink4 }}>drop → video/public/footage/{slot.id}/capture.mp4 (or .png)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10, marginTop: 6 }}>
          {slot.mustShow.map((m) => (
            <div key={m} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', font: `400 ${compact ? 17 : 21}px/1.35 ${F.sans}`, color: C.ink2 }}>
              <span style={{ marginTop: 2, color: C.ink4 }}><Icon name="check" size={compact ? 18 : 21} /></span>
              <span><Bidi text={m} /></span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
