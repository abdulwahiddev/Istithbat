import type { CSSProperties, ReactNode } from 'react';
import { useCurrentFrame } from 'remotion';
import { C, F, LAYER, type Layer } from '../brand';
import type { Pt } from '../footage';
import { prog } from './anim';
import { Icon, type IconName } from './Icon';
import { FRAME } from './layout';

type Size = { w: number; h: number };

/**
 * A typographic callout restating a verified fact, optionally tied to a point on the footage with a
 * drawn leader rule. Styled after the landing's `.tag-in` evidence tags (float plate, chip line,
 * layer icon + muted key over the value). Positions are px inside the footage frame.
 */
export function Callout({ at, until, x, y, w, anchor, frameSize = FRAME, layer, icon, iconColor, label, children, style, align = 'left' }: {
  at: number; until?: number; x: number; y: number; w?: number; anchor?: Pt; frameSize?: Size;
  layer?: Layer; icon?: IconName; iconColor?: string; label?: ReactNode; children?: ReactNode; style?: CSSProperties; align?: 'left' | 'right';
}) {
  const frame = useCurrentFrame();
  const pIn = prog(frame, at, 0.55);
  const pOut = until != null ? 1 - prog(frame, until, 0.35) : 1;
  const p = Math.min(pIn, pOut);
  if (p <= 0) return null;
  const ic = icon ?? (layer ? LAYER[layer].icon : undefined);
  const col = iconColor ?? (layer ? LAYER[layer].color : C.ink2);
  const ax = anchor ? anchor.x * frameSize.w : 0, ay = anchor ? anchor.y * frameSize.h : 0;
  const lineP = prog(frame, at + 0.15, 0.6) * pOut;
  // leader starts at the card's nearer vertical edge, mid-height (estimated card height 76px)
  const cardW = w ?? 360;
  const sx = ax < x ? x : x + cardW, sy = y + 38;
  const len = Math.hypot(ax - sx, ay - sy);
  return (
    <>
      {anchor && (
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={frameSize.w} height={frameSize.h}>
          <line x1={sx} y1={sy} x2={ax} y2={ay} stroke={col} strokeOpacity={0.8} strokeWidth={1.5}
            strokeDasharray={len} strokeDashoffset={len * (1 - lineP)} />
          <circle cx={ax} cy={ay} r={5 * lineP} fill={col} />
          <circle cx={ax} cy={ay} r={11 * lineP} fill="none" stroke={col} strokeOpacity={0.35} strokeWidth={1.5} />
        </svg>
      )}
      <div style={{
        position: 'absolute', left: x, top: y, width: w, opacity: p, transform: `translateY(${(1 - pIn) * 12}px)`,
        padding: '14px 18px 15px', borderRadius: 14, background: 'rgba(18,20,24,.94)', border: `1px solid ${C.chipLine}`,
        boxShadow: C.floatShadow, backdropFilter: 'blur(18px)', fontFamily: F.sans, textAlign: align, ...style,
      }}>
        {label != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, font: `500 17px/22px ${F.sans}`, color: C.ink3, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
            {ic && <span style={{ color: col, display: 'flex' }}><Icon name={ic} size={18} /></span>}{label}
          </div>
        )}
        {children != null && <div style={{ marginTop: label != null ? 5 : 0, font: `500 24px/31px ${F.sans}`, color: C.ink }}>{children}</div>}
      </div>
    </>
  );
}

export const Mono = ({ children, color }: { children: ReactNode; color?: string }) =>
  <span style={{ fontFamily: F.mono, fontSize: '0.9em', letterSpacing: 0, color }}>{children}</span>;

/** Status dot + label, product status colours (landing `.st` / Strata `.stm`). */
export const Status = ({ color, children, ring }: { color: string; children: ReactNode; ring?: boolean }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color }}>
    <i style={{ width: 10, height: 10, borderRadius: '50%', background: ring ? 'transparent' : color, boxShadow: ring ? `inset 0 0 0 2px ${color}` : `0 0 0 4px ${color}22` }} />
    {children}
  </span>
);
