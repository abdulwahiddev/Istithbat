import type { ReactNode } from 'react';

/**
 * System states (Design System §10): say what happened, what it means, and what the user can do.
 * They use circles and full-width bars, never verdict squares, so "could not load" is never
 * mistaken for a finding about the content.
 */

export function ErrorState({ title, message, code, children }: { title: string; message: string; code?: string; children?: ReactNode }) {
  return (
    <div className="ist-state ist-state--error" role="alert">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" />
        <path d="M8 4.5v4.5M8 11v.8" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <div className="ist-state__body">
        <strong>{title}</strong>
        <span>{message}</span>
        {code && <span className="ist-mono ist-meta">{code}</span>}
        <span className="ist-meta">No preview or cached data is shown in its place. Nothing has been changed.</span>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ist-state ist-state--empty">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeDasharray="2.5 2" />
      </svg>
      <div className="ist-state__body">
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

/** Flat skeleton blocks in the positions of the content they stand for. */
export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="ist-stack" style={{ gap: 10 }}>
      <span className="ist-sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="ist-skeleton" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <>
      <div className="ist-topbar" aria-hidden="true">
        <div className="ist-skeleton" style={{ width: 220, height: 12 }} />
      </div>
      <main className="ist-content">
        <div className="ist-loadbar" aria-hidden="true" />
        <div className="ist-skeleton" style={{ width: 120, height: 10, marginBlockEnd: 12 }} />
        <div className="ist-skeleton" style={{ width: 320, height: 28, marginBlockEnd: 28 }} />
        <div className="ist-skeleton" style={{ height: 120, marginBlockEnd: 28 }} />
        <Skeleton lines={5} label={label} />
      </main>
    </>
  );
}
