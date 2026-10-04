import type { ReactNode } from 'react';

/** SHA-256 shown truncated in mono; the full value stays in the DOM (title + sr text) for verification. */
export function Hash({ value, label = 'sha256', head = 8, tail = 4 }: { value: string | null | undefined; label?: string; head?: number; tail?: number }) {
  if (!value) return <span className="ist-hash ist-diff__empty">no hash</span>;
  const short = value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
  return (
    <span className="ist-hash" title={`${label} ${value}`}>
      <span className="ist-hash__algo">{label}</span>
      <bdi dir="ltr" aria-hidden="true">{short}</bdi>
      <span className="ist-sr-only">{value}</span>
    </span>
  );
}

/** Identifiers and version labels are mono and bidi-isolated so they never jump sides inside Arabic. */
export function Mono({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="ist-mono">
      {children}
    </bdi>
  );
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export function isArabic(text: string): boolean {
  return ARABIC.test(text);
}

/**
 * A source value rendered verbatim. Arabic gets dir="rtl", lang="ar" and the Naskh face
 * reserved for quoting source text; nothing is normalised, trimmed or re-shaped.
 */
export function SourceValue({ value }: { value: unknown }) {
  if (value === undefined) return <span className="ist-diff__empty">absent</span>;
  if (value === null) return <span className="ist-diff__empty">null</span>;
  if (typeof value === 'string') {
    if (isArabic(value)) {
      return (
        <span className="ist-source-ar" lang="ar" dir="rtl">
          {value}
        </span>
      );
    }
    return <span className="ist-diff__value">{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <Mono>{String(value)}</Mono>;
  return (
    <pre className="ist-mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }} dir="ltr">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Old → new, trusted side first. Values are exact; no interpretation is added here. */
export function ExactDiff({ oldValue, newValue, oldLabel = 'Before', newLabel = 'After' }: { oldValue: unknown; newValue: unknown; oldLabel?: string; newLabel?: string }) {
  return (
    <div className="ist-diff">
      <div className="ist-diff__side ist-diff__side--old">
        <div className="ist-diff__label">{oldLabel}</div>
        <SourceValue value={oldValue} />
      </div>
      <span className="ist-diff__arrow" aria-label="changed to">
        →
      </span>
      <div className="ist-diff__side ist-diff__side--new">
        <div className="ist-diff__label">{newLabel}</div>
        <SourceValue value={newValue} />
      </div>
    </div>
  );
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
