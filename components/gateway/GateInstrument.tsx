'use client';
import { useState } from 'react';

export type GateProps = {
  appName: string;
  trusted: string;
  served: string;
  /** held candidate at the gate; null when nothing is held */
  candidate: { label: string; state: string; policyCode: string | null } | null;
};

const Lock = ({ open }: { open?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="9" width="11" height="8" rx="2" /><path d={open ? 'M7 9V5.5a3 3 0 015.6-1.5' : 'M7 9V6.5a3 3 0 016 0V9'} />
  </svg>
);
const Pkts = () => <><span className="pkt" /><span className="pkt" style={{ animationDelay: '-1.2s' }} /><span className="pkt" style={{ animationDelay: '-2.4s' }} /></>;
const card = { position: 'absolute', left: '74%', right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 14px', borderRadius: 16 } as const;
const chip = (bg: string, text: string) => <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: bg }} />{text}</span>;

/** The gate (Trust Gateway hero). "If approved" is a preview computed from the same facts; nothing changes until a reviewer signs. */
export function GateInstrument({ appName, trusted, served, candidate }: GateProps) {
  const [view, setView] = useState<'now' | 'after'>('now');
  const after = view === 'after' && !!candidate;
  const title = after ? `If a reviewer approves ${candidate!.label}` : `Production is reading ${served}`;
  const aria = after
    ? `Preview: ${candidate!.label} passes the gate and ${appName} reads ${candidate!.label}; ${trusted} is superseded.`
    : candidate ? `${candidate.label} is stopped at the Trust Gateway${candidate.policyCode ? ` by ${candidate.policyCode}` : ''}. ${served} passes through and is served to ${appName}.`
      : `Nothing is held at the Trust Gateway. ${served} passes through and is served to ${appName}.`;
  const seen = after ? candidate!.label : candidate?.label ?? trusted;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h3 className="h3">{title}</h3>
        {candidate && (
          <div className="mseg" role="group" aria-label="Gateway view" style={{ marginTop: -7 }}>
            <button type="button" aria-pressed={!after} onClick={() => setView('now')}>Now</button>
            <button type="button" aria-pressed={after} onClick={() => setView('after')}>If approved</button>
          </div>
        )}
      </div>
      <div className="plate" style={{ paddingTop: 28, paddingBottom: 28 }}>
        <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}>
          <div className="gw" role="img" aria-label={aria}>
            <span className="zl" style={{ left: 0 }}>Upstream</span>
            <span className="zl" style={{ left: '58%', transform: 'translateX(-50%)' }}>Trust Gateway</span>
            <span className="zl" style={{ left: '74%' }}>Production</span>
            <span className="zone" aria-hidden="true" />
            <div key={after ? 'after' : 'now'} className="fade">
              {!after && candidate && <>
                <div className="lane" style={{ left: '20%', width: '35%', top: 114, background: 'var(--co-soft)', boxShadow: 'inset 0 0 0 1px var(--co)' }} />
                <div style={{ position: 'absolute', left: 'calc(55% - 4px)', top: 100, width: 4, height: 40, borderRadius: 2, background: 'var(--co)' }} />
                <span style={{ position: 'absolute', left: '36%', top: 84, fontSize: 13, color: 'var(--co-ink)' }}>Stopped at the gate</span>
                <div className="vchip" style={{ left: 0, top: 120, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--co)' }}>{candidate.label}</span><span className="t"><span>Latest seen</span><span style={{ color: 'var(--co-ink)' }}>{candidate.state}</span></span></div>
                <div style={{ ...card, top: 120, border: '1px dashed var(--line-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{candidate.label}</b>{chip('var(--co)', 'Not served')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Candidate · bound to no app</span>
                </div>
              </>}
              {!after && !candidate && <>
                <span style={{ position: 'absolute', left: '20%', top: 104, fontSize: 13, color: 'var(--ink-3)' }}>Nothing waiting at the gate</span>
              </>}
              {!after && <>
                <div className="lane flow" style={{ zIndex: 2, left: '20%', width: '52%', top: 254, backgroundColor: 'var(--tq-soft)', boxShadow: 'inset 0 0 0 1px var(--tq-line)' }}><Pkts /></div>
                <div className="vchip" style={{ left: 0, top: 260, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--tq)' }}>{trusted}</span><span className="t"><span>Latest trusted</span><span style={{ color: 'var(--ink-3)' }}>Trusted</span></span></div>
                <div className="gatebar" style={{ background: 'var(--gate)' }} />
                <div className="lockb"><Lock /><span>{candidate ? <>Locked{candidate.policyCode && <> · <span className="mono">{candidate.policyCode}</span></>}</> : 'Trusted only'}</span></div>
                <div className="float" style={{ ...card, top: 260 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }}>{appName}</b>{chip('var(--tq)', 'Serving')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Reads <span className="mono">{served}</span></span>
                </div>
              </>}
              {after && <>
                <div className="lane flow" style={{ zIndex: 2, left: '20%', width: '52%', top: 114, backgroundColor: 'var(--tq-soft)', boxShadow: 'inset 0 0 0 1px var(--tq-line)' }}><Pkts /></div>
                <div className="lane" style={{ left: '20%', width: '35%', top: 254, background: 'var(--hover)', boxShadow: 'inset 0 0 0 1px var(--line-2)' }} />
                <div style={{ position: 'absolute', left: 'calc(55% - 4px)', top: 240, width: 4, height: 40, borderRadius: 2, background: 'var(--ink-4)' }} />
                <span style={{ position: 'absolute', left: '36%', top: 224, fontSize: 13, color: 'var(--ink-3)' }}>Superseded, kept in the record</span>
                <div className="vchip" style={{ left: 0, top: 120, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--tq)' }}>{candidate!.label}</span><span className="t"><span>Latest seen</span><span style={{ color: 'var(--ink-3)' }}>Trusted</span></span></div>
                <div className="vchip" style={{ left: 0, top: 260, color: 'var(--ink-3)' }}><span className="v" style={{ borderColor: 'var(--line-2)' }}>{trusted}</span><span className="t"><span>Previous</span><span>Superseded</span></span></div>
                <div className="gatebar" style={{ background: 'var(--gate)' }} />
                <div className="lockb"><Lock open /><span>Opened by signed approval</span></div>
                <div className="float" style={{ ...card, top: 120 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }}>{appName}</b>{chip('var(--tq)', 'Serving')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Reads <span className="mono">{candidate!.label}</span> · switched atomically</span>
                </div>
                <div style={{ ...card, top: 260, border: '1px dashed var(--line-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{trusted}</b>{chip('var(--ink-4)', 'Superseded')}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>No longer bound</span>
                </div>
              </>}
            </div>
          </div>
        </div>
        <div className="inv" style={{ marginTop: 28 }}>
          <div className="tile"><span className="cap">Latest seen</span><span className="ver mono">{seen}</span>
            <span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: candidate && !after ? 'var(--co)' : 'var(--tq)' }} />{candidate && !after ? candidate.state : 'Trusted'}</span></div>
          <span className="op" aria-label={candidate && !after ? 'is not' : 'equals'}>{candidate && !after ? '≠' : '='}</span>
          <div className="tile"><span className="cap">Latest trusted</span><span className="ver mono">{after ? candidate!.label : trusted}</span><span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: 'var(--tq)' }} />Trusted</span></div>
          <span className="op" aria-label={after || served === trusted ? 'equals' : 'is not'}>{after || served === trusted ? '=' : '≠'}</span>
          <div className="tile"><span className="cap">Served to {appName}</span><span className="ver mono">{after ? candidate!.label : served}</span><span className="chip" style={{ alignSelf: 'flex-start' }}><span className="dot" style={{ background: 'var(--tq)' }} />Serving</span></div>
        </div>
      </div>
      {after
        ? <p className="body fade" style={{ display: 'flex', gap: 10, alignItems: 'baseline', color: 'var(--ink-3)' }}><span className="mk mk-hum" style={{ width: 8, height: 8, background: 'var(--ink-3)' }} />Preview only. Nothing changes until a reviewer signs the decision on the incident.</p>
        : <p className="body" style={{ color: 'var(--ink-3)' }}>Latest seen is not the same as trusted, and only trusted is served. The protected app resolves the gateway, never the newest upstream version.</p>}
    </>
  );
}
