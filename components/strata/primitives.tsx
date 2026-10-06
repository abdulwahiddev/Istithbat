import { Icon } from './icons';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

/**
 * Strata primitives: thin, typed wrappers over the frozen class names. They add no styling of their
 * own; markup mirrors the boards so the shared CSS applies unchanged.
 */

export type Layer = 'src' | 'det' | 'ai' | 'pol' | 'hum';
export type Tone = 'tq' | 'co' | 'am' | 'pu' | 'n' | 'ink3' | 'n4';

export const toneVar: Record<Tone, string> = {
  tq: 'var(--tq)', co: 'var(--co)', am: 'var(--am)', pu: 'var(--pu)', n: 'var(--line-2)', ink3: 'var(--ink-3)', n4: 'var(--ink-4)',
};

export function Mk({ layer, style }: { layer: Layer; style?: CSSProperties }) {
  return <span className={`mk mk-${layer}`} style={style} aria-hidden="true" />;
}

export function Dot({ tone, style }: { tone: Tone; style?: CSSProperties }) {
  return <span className="dot" style={{ background: toneVar[tone], ...style }} aria-hidden="true" />;
}

/** Chip with a state dot. `dashedDot` renders the stale mark (a solid ring; dashes break up at 8px). */
export function Chip({ tone, children, small, ink, dashedDot, style }: {
  tone?: Tone; children: ReactNode; small?: boolean; ink?: boolean; dashedDot?: boolean; style?: CSSProperties;
}) {
  const s: CSSProperties = { ...(small ? { padding: '1px 9px 1px 7px', fontSize: 12 } : {}), ...(ink ? { color: 'var(--ink)' } : {}), ...style };
  return (
    <span className="chip" style={s}>
      {tone && (dashedDot
        ? <span className="stm stm-stale" aria-hidden="true" />
        : <Dot tone={tone} />)}
      {children}
    </span>
  );
}

export const Mono = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <span className="mono" style={style}>{children}</span>;

export function Kv({ k, children, style }: { k: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return <div className="kv" style={style}><span>{k}</span><span>{children}</span></div>;
}

/** Definition-list row for the header status panels (dl.plate.in). */
export function Dk({ k, children, style }: { k: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return <div className="kv"><dt>{k}</dt><dd style={style}>{children}</dd></div>;
}

export function Rail({ layer, id, title, children, decision, titleStyle }: {
  layer: Layer; id: string; title: string; children: ReactNode; decision?: boolean; titleStyle?: CSSProperties;
}) {
  return (
    <div className="rail" style={decision ? { paddingTop: 4 } : undefined}>
      <Mk layer={layer} /><h2 id={id} style={titleStyle}>{title}</h2><p>{children}</p>
    </div>
  );
}

/** A band: rail + main on the 12-column grid. */
export function Band({ id, labelledBy, first, children }: { id?: string; labelledBy: string; first?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="band" aria-labelledby={labelledBy} style={first ? { paddingTop: 0 } : undefined}>
      <div className="wrap g">{children}</div>
    </section>
  );
}

/** Section heading row: .h3 flush with main, meta/link on the right sharing its baseline. */
export function HeadRow({ title, right, align = 'baseline' }: { title: ReactNode; right?: ReactNode; align?: 'baseline' | 'flex-start' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: align, gap: 16, flexWrap: 'wrap' }}>
      <h3 className="h3">{title}</h3>{right}
    </div>
  );
}

export function Lnk({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="lnk" href={href}>{children} <span aria-hidden="true">→</span></Link>;
}

/** Page header band: crumbs, answer-first H1, lede and the status panel (columns 9–12). */
export function PageHeader({ crumbs, title, lede, status, synthetic }: { crumbs: ReactNode; title: ReactNode; lede: ReactNode; status: ReactNode; synthetic?: boolean }) {
  return (
    <section className="phd">
      <div className="wrap g" style={{ rowGap: 14, alignItems: 'start' }}>
        <nav aria-label="Breadcrumb" className="crumbs" style={{ gridColumn: '1 / -1' }}>{crumbs}</nav>
        <div className="ph-lead" style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
          <h1 className="ph-title">{title}</h1>
          <p className="meta" style={{ margin: 0, fontSize: 15, maxWidth: 620 }}>{lede}</p>
        </div>
        <dl className="plate in ph-status" style={{ gridColumn: '9 / span 4', margin: '0 -24px', padding: '8px 24px' }}>{status}{synthetic && <SyntheticRow />}</dl>
      </div>
    </section>
  );
}

export const Sep = () => <span aria-hidden="true">/</span>;

/** The controlled-synthetic notice (D-13), as a fact in the case's state panel rather than in navigation. */
export function SyntheticRow() {
  return (
    <div className="kv"><dt>Source data</dt><dd><span className="pill" style={{ padding: '2px 10px', border: '1px solid var(--am-soft)', background: 'var(--am-soft)', color: 'var(--am-ink)', fontSize: 12.5 }}><Dot tone="am" />Synthetic, not real hadith data</span></dd></div>
  );
}

export function Ev({ mark, time, title, note, code, titleStyle }: {
  mark: ReactNode; time: ReactNode; title: ReactNode; note?: ReactNode; code?: ReactNode; titleStyle?: CSSProperties;
}) {
  return (
    <div className="ev">
      {mark}<span className="tm mono">{time}</span>
      <span className="w"><b style={titleStyle}>{title}</b>{note && <span>{note}</span>}</span>
      <span className="who-l mono">{code}</span>
    </div>
  );
}

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" /></svg>
);

/**
 * The decision band used on every screen except Incident Review: handoff chips, drop line and the
 * summary dock that sends the reviewer to the incident's decision. The human act itself lives only
 * on Incident Review.
 */
export function SummaryDock({ railText, left, right, question, body, href, cta, helper }: {
  railText: ReactNode; left: ReactNode; right: ReactNode; question: ReactNode; body: ReactNode; href: string; cta: string; helper: ReactNode;
}) {
  return (
    <section aria-labelledby="h-dock" style={{ padding: '64px 0 120px' }}>
      <div className="wrap g">
        <Rail layer="hum" id="h-dock" title="Review decision" decision>{railText}</Rail>
        <div className="main" style={{ gap: 0 }}>
          <div className="handoff">
            {left}
            <span className="handoff-line" aria-hidden="true" />
            {right}
          </div>
          <div className="handoff-drop" aria-hidden="true" />
          <div className="desk" style={{ paddingTop: 32, paddingBottom: 32 }}>
            <div className="sub" style={{ alignItems: 'center', rowGap: 20 }}>
              <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 600, letterSpacing: '-.018em' }}>{question}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--h-ink-2)' }}>{body}</p>
              </div>
              <div className="c7-10" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link className="btn btn-go" href={href} style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>{cta}<Arrow /></Link>
                <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--h-ink-3)', textAlign: 'center' }}>{helper}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Who can sign right now. Locked: anyone may inspect and preview decisions, but signing needs
 * Reviewer Mode. Active: the signed-in reviewer's signature records a real decision.
 */
export const ReviewerStatus = ({ active }: { active: boolean }) => (
  <span className="chip" style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}>
    <Icon name={active ? 'user-check' : 'lock'} size={14} />{active ? 'Reviewer active' : 'Reviewer locked'}
  </span>
);
export const HandedToYou = ({ children = 'Handed to you' }: { children?: ReactNode }) => (
  <span className="chip" style={{ color: 'var(--ink)' }}><Mk layer="hum" style={{ width: 8, height: 8 }} />{children}</span>
);
export const HeldBy = ({ code, verb = 'Held by' }: { code: string; verb?: string }) => (
  <span className="chip"><Mk layer="pol" style={{ width: 8, height: 8, borderColor: 'var(--ink-2)' }} />{verb} <span className="mono">{code}</span></span>
);

/** A read failure, stated plainly inside the band it belongs to. */
export function ReadError({ message, code }: { message: string; code: string }) {
  return (
    <div className="plate" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b style={{ fontSize: 16 }}>Not available</b>
      <p className="body">{message}</p>
      <span className="meta mono">{code}</span>
    </div>
  );
}
