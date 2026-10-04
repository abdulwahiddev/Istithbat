import type { ReactNode } from 'react';
import { formatTimestamp } from '../evidence/Evidence';

/** D-13: required on the simulator, Source Detail and the protected app. Exact wording. */
export function SyntheticSourceBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="ist-banner ist-banner--synthetic" role="note">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginBlockStart: 3, flex: 'none' }}>
        <path d="M7 1 13 12H1Z" fill="none" stroke="var(--amber)" />
        <path d="M7 5v3.5M7 10v.6" stroke="var(--amber)" strokeWidth="1.3" />
      </svg>
      <div className="ist-banner__body">
        <strong>CONTROLLED SYNTHETIC SOURCE — not real hadith data</strong>
        <span className="ist-banner__meta">
          {children ??
            'Every record, grader, narrator and reference in this source is synthetic demo infrastructure. Nothing here is attributed to the Prophet ﷺ or to any real scholar or provider.'}
        </span>
      </div>
    </div>
  );
}

/** Shown whenever a screen renders data that did not come from the live backend. */
export function PreviewDataBanner({ reason, children }: { reason: string; children?: ReactNode }) {
  return (
    <div className="ist-banner ist-banner--preview" role="note">
      <div className="ist-banner__body">
        <strong className="ist-eyebrow" style={{ color: 'var(--text-secondary)' }}>
          Preview data · not produced by the integrity engine
        </strong>
        <span className="ist-banner__meta">{reason}</span>
        {children}
      </div>
    </div>
  );
}

/** D-15: whenever AI_MODE=replay, the UI must say so with the recording time. Never silent. */
export function ReplayedResponseLabel({ recordedAt }: { recordedAt: string | null }) {
  return (
    <span className="ist-badge ist-badge--analysis" title="AI_MODE=replay: a recorded live response, not a new model call">
      Replayed response (recorded {formatTimestamp(recordedAt)})
    </span>
  );
}

/** Small mode indicator for any machine-analysis block. */
export function AiModeLabel({ mode, recordedAt }: { mode: 'live' | 'mock' | 'replay'; recordedAt?: string | null }) {
  if (mode === 'replay') return <ReplayedResponseLabel recordedAt={recordedAt ?? null} />;
  if (mode === 'mock')
    return (
      <span className="ist-badge ist-badge--muted ist-badge--dashed" title="AI_MODE=mock: deterministic canned output for testing">
        Mock output · no model called
      </span>
    );
  return <span className="ist-badge ist-badge--analysis">Live model output</span>;
}
