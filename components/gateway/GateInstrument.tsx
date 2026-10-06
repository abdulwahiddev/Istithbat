'use client';
import { useState } from 'react';
import { Icon } from '@/components/strata/icons';
import { Tx, useT } from '@/components/strata/i18n/client';

export type GateCandidate = { label: string; state: string; policyCode: string | null };
export type GateProps = {
  appName: string;
  trusted: string;
  served: string;
  /** held candidate at the gate; null when nothing is held */
  candidate: GateCandidate | null;
};
/** One bound source of a protected app: its own trusted/served versions and, possibly, a held candidate. */
export type GateLane = { sourceId: string; sourceName: string; trusted: string; served: string; candidate: GateCandidate | null };

const Lock = ({ open }: { open?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="9" width="11" height="8" rx="2" /><path d={open ? 'M7 9V5.5a3 3 0 015.6-1.5' : 'M7 9V6.5a3 3 0 016 0V9'} />
  </svg>
);
const Pkts = () => <><span className="pkt" /><span className="pkt" style={{ animationDelay: '-1.2s' }} /><span className="pkt" style={{ animationDelay: '-2.4s' }} /></>;
const card = { position: 'absolute', insetInlineStart: '74%', insetInlineEnd: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 14px', borderRadius: 16 } as const;
const chip = (bg: string, text: string) => <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: bg }} /><Tx>{text}</Tx></span>;

/**
 * Trust Gateway for a protected app. One bound source: the full gate diagram. Several: one shared
 * gateway with a compact lane per source (candidate stops at the gate; trusted continues), and the
 * selected lane opens in the full diagram below. Scales to many sources without repeating diagrams.
 */
export function GatewayLanes({ appName, lanes, initialSourceId }: { appName: string; lanes: GateLane[]; initialSourceId?: string }) {
  const [selId, setSelId] = useState(initialSourceId ?? lanes[0]?.sourceId);
  const t = useT();
  const sel = lanes.find((l) => l.sourceId === selId) ?? lanes[0];
  if (!sel) return null;
  if (lanes.length === 1) return <GateInstrument appName={appName} trusted={sel.trusted} served={sel.served} candidate={sel.candidate} />;
  const held = lanes.filter((l) => l.candidate).length;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h3 className="h3">{t('Source lanes · {n}', { n: lanes.length })}</h3>
        <span className="meta">{held ? t('{h} held at the gate · {p} passing', { h: held, p: lanes.length - held }) : t('Every source is serving its trusted version')}</span>
      </div>
      <div className="plate tight glanes" role="list" aria-label={t('Sources bound to {app}', { app: appName })}>
        <div className="glh" aria-hidden="true"><span>{t('Source')}</span><span>{t('Upstream · stops at the gateway')}</span><span>{t('Gateway')}</span><span>{t('Production')} · {appName}</span></div>
        {lanes.map((l) => (
          <button key={l.sourceId} type="button" role="listitem" className={`glane${l.sourceId === sel.sourceId ? ' on' : ''}`} aria-pressed={l.sourceId === sel.sourceId} onClick={() => setSelId(l.sourceId)}
            aria-label={`${l.sourceName}: ${l.candidate ? `${l.candidate.label} ${l.candidate.state.toLowerCase()} at the gate; ` : 'nothing held; '}${appName} reads ${l.served}`}>
            <span className="gl-src"><b dir="auto" title={l.sourceName}>{l.sourceName}</b><span className="mono">{t(`${l.trusted} trusted`)}</span></span>
            <span className="gl-up">
              {l.candidate
                ? <span className="gl-held"><span className="gl-chip mono">{l.candidate.label}</span><span className="gl-line co" /><span className="gl-stop" /></span>
                : <span className="gl-none">{t('No candidate waiting')}</span>}
              <span className="gl-pass"><span className="gl-chip mono tq">{l.trusted}</span><span className="gl-line tq" /></span>
            </span>
            <span className="gl-gate" aria-hidden="true">{l.candidate && <Icon name="lock" size={12} />}</span>
            <span className="gl-prod"><span className="gl-line tq" /><span className="gl-reads">{t('Reads')} <span className="mono">{l.served}</span></span></span>
          </button>
        ))}
      </div>
      <div key={sel.sourceId} className="fade" style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}>
        <GateInstrument appName={appName} trusted={sel.trusted} served={sel.served} candidate={sel.candidate} sourceName={sel.sourceName} />
      </div>
    </>
  );
}

/** The gate (Trust Gateway hero). "If approved" is a preview computed from the same facts; nothing changes until a reviewer signs. */
export function GateInstrument({ appName, trusted, served, candidate, sourceName }: GateProps & { sourceName?: string }) {
  const [view, setView] = useState<'now' | 'after'>('now');
  const after = view === 'after' && !!candidate;
  const t = useT();
  const title = sourceName ? `${sourceName} · ${t(after ? 'after approval' : 'serving state')}` : t(after ? 'Serving state · after approval' : 'Serving state');
  const aria = after
    ? t('Preview: {c} passes the gate and {app} reads {c}; {tr} is superseded.', { c: candidate!.label, app: appName, tr: trusted })
    : candidate ? t(candidate.policyCode ? '{c} is stopped at the Trust Gateway by {code}. {s} passes through and is served to {app}.' : '{c} is stopped at the Trust Gateway. {s} passes through and is served to {app}.', { c: candidate.label, code: candidate.policyCode ?? '', s: served, app: appName })
      : t('Nothing is held at the Trust Gateway. {s} passes through and is served to {app}.', { s: served, app: appName });
  const seen = after ? candidate!.label : candidate?.label ?? trusted;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h3 className="h3">{title}</h3>
        {candidate && (
          <div className="mseg" role="group" aria-label={t('Gateway view')} style={{ marginTop: -7 }}>
            <button type="button" aria-pressed={!after} onClick={() => setView('now')}>{t('Now')}</button>
            <button type="button" aria-pressed={after} onClick={() => setView('after')}>{t('If approved')}</button>
          </div>
        )}
      </div>
      <div className="plate" style={{ paddingTop: 28, paddingBottom: 28 }}>
        <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}>
          <div className="gw" role="img" aria-label={aria}>
            <span className="zl" style={{ insetInlineStart: 0 }}>{t('Upstream')}</span>
            <span className="zl zl-c" style={{ insetInlineStart: '58%', transform: 'translateX(-50%)' }}>{t('Trust Gateway')}</span>
            <span className="zl" style={{ insetInlineStart: '74%' }}>{t('Production')}</span>
            <span className="zone" aria-hidden="true" />
            <div key={after ? 'after' : 'now'} className="fade">
              {!after && candidate && <>
                <div className="lane" style={{ insetInlineStart: '20%', width: '35%', top: 114, background: 'var(--co-soft)', boxShadow: 'inset 0 0 0 1px var(--co)' }} />
                <div style={{ position: 'absolute', insetInlineStart: 'calc(55% - 4px)', top: 100, width: 4, height: 40, borderRadius: 2, background: 'var(--co)' }} />
                <span style={{ position: 'absolute', insetInlineStart: '36%', top: 84, fontSize: 13, color: 'var(--co-ink)' }}>{t('Stopped at the gate')}</span>
                <div className="vchip" style={{ insetInlineStart: 0, top: 120, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--co)' }}>{candidate.label}</span><span className="t"><span>{t('Latest seen')}</span><span style={{ color: 'var(--co-ink)' }}>{t(candidate.state)}</span></span></div>
                <div style={{ ...card, top: 120, border: '1px dashed var(--line-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{candidate.label}</b>{chip('var(--co)', 'Not served')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('Candidate · bound to no app')}</span>
                </div>
              </>}
              {!after && !candidate && <>
                <span style={{ position: 'absolute', insetInlineStart: '20%', top: 104, fontSize: 13, color: 'var(--ink-3)' }}>{t('Nothing waiting at the gate')}</span>
              </>}
              {!after && <>
                <div className="lane flow" style={{ zIndex: 2, insetInlineStart: '20%', width: '52%', top: 254, backgroundColor: 'var(--tq-soft)', boxShadow: 'inset 0 0 0 1px var(--tq-line)' }}><Pkts /></div>
                <div className="vchip" style={{ insetInlineStart: 0, top: 260, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--tq)' }}>{trusted}</span><span className="t"><span>{t('Latest trusted')}</span><span style={{ color: 'var(--ink-3)' }}>{t('Trusted')}</span></span></div>
                <div className="gatebar" style={{ background: 'var(--gate)' }} />
                <div className="lockb"><Lock /><span>{candidate ? <>{t('Locked')}{candidate.policyCode && <> · <span className="mono">{candidate.policyCode}</span></>}</> : t('Trusted only')}</span></div>
                <div className="float" style={{ ...card, top: 260 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }} dir="auto">{appName}</b>{chip('var(--tq)', 'Serving')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('Reads')} <span className="mono">{served}</span></span>
                </div>
              </>}
              {after && <>
                <div className="lane flow" style={{ zIndex: 2, insetInlineStart: '20%', width: '52%', top: 114, backgroundColor: 'var(--tq-soft)', boxShadow: 'inset 0 0 0 1px var(--tq-line)' }}><Pkts /></div>
                <div className="lane" style={{ insetInlineStart: '20%', width: '35%', top: 254, background: 'var(--hover)', boxShadow: 'inset 0 0 0 1px var(--line-2)' }} />
                <div style={{ position: 'absolute', insetInlineStart: 'calc(55% - 4px)', top: 240, width: 4, height: 40, borderRadius: 2, background: 'var(--ink-4)' }} />
                <span style={{ position: 'absolute', insetInlineStart: '36%', top: 224, fontSize: 13, color: 'var(--ink-3)' }}>{t('Superseded, kept in the record')}</span>
                <div className="vchip" style={{ insetInlineStart: 0, top: 120, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--tq)' }}>{candidate!.label}</span><span className="t"><span>{t('Latest seen')}</span><span style={{ color: 'var(--ink-3)' }}>{t('Trusted')}</span></span></div>
                <div className="vchip" style={{ insetInlineStart: 0, top: 260, color: 'var(--ink-3)' }}><span className="v" style={{ borderColor: 'var(--line-2)' }}>{trusted}</span><span className="t"><span>{t('Previous')}</span><span>{t('Superseded')}</span></span></div>
                <div className="gatebar" style={{ background: 'var(--gate)' }} />
                <div className="lockb"><Lock open /><span>{t('Opened by signed approval')}</span></div>
                <div className="float" style={{ ...card, top: 120 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }} dir="auto">{appName}</b>{chip('var(--tq)', 'Serving')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('Reads')} <span className="mono">{candidate!.label}</span> · {t('switched atomically')}</span>
                </div>
                <div style={{ ...card, top: 260, border: '1px dashed var(--line-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{trusted}</b>{chip('var(--ink-4)', 'Superseded')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('No longer bound')}</span>
                </div>
              </>}
            </div>
          </div>
        </div>
        <div className="inv" style={{ marginTop: 28 }}>
          <div className="tile"><span className="cap">{t('Latest seen')}</span><span className="ver mono">{seen}</span>
            <span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: candidate && !after ? 'var(--co)' : 'var(--tq)' }} />{t(candidate && !after ? candidate.state : 'Trusted')}</span></div>
          <span className="op" aria-label={t(candidate && !after ? 'is not' : 'equals')}>{candidate && !after ? '≠' : '='}</span>
          <div className="tile"><span className="cap">{t('Latest trusted')}</span><span className="ver mono">{after ? candidate!.label : trusted}</span><span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: 'var(--tq)' }} />{t('Trusted')}</span></div>
          <span className="op" aria-label={t(after || served === trusted ? 'equals' : 'is not')}>{after || served === trusted ? '=' : '≠'}</span>
          <div className="tile"><span className="cap">{t('Served to {app}', { app: appName })}</span><span className="ver mono">{after ? candidate!.label : served}</span><span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: 'var(--tq)' }} />{t('Serving')}</span></div>
        </div>
      </div>
      {after
        ? <p className="body fade" style={{ display: 'flex', gap: 10, alignItems: 'baseline', color: 'var(--ink-3)' }}><span className="mk mk-hum" style={{ width: 8, height: 8, background: 'var(--ink-3)' }} />{t('Preview only. Nothing changes until a reviewer signs the decision on the incident.')}</p>
        : <p className="body" style={{ color: 'var(--ink-3)' }}>{t('Latest seen is not the same as trusted, and only trusted is served. The protected app resolves the gateway, never the newest upstream version.')}</p>}
    </>
  );
}
