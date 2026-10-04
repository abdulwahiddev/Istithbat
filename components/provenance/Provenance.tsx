import type { ReactNode } from 'react';

/**
 * The four layers every screen keeps visibly separate (CLAUDE.md, Bible §13).
 * Meaning never rides on colour alone: each layer has a glyph, a word and a colour.
 */
export type ProvenanceKind = 'source' | 'deterministic' | 'analysis' | 'human';

const LABELS: Record<ProvenanceKind, string> = {
  source: 'Source',
  deterministic: 'Deterministic evidence',
  analysis: 'Machine analysis · advisory',
  human: 'Human decision',
};

const DESCRIPTIONS: Record<ProvenanceKind, string> = {
  source: 'Upstream content exactly as the provider published it',
  deterministic: 'Computed by Istithbat: hashes, diffs, declared roles, policy triggers',
  analysis: 'AI-generated interpretation; it can raise a policy action, never lower it',
  human: 'A reviewer’s governance decision',
};

function Glyph({ kind }: { kind: ProvenanceKind }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true } as const;
  switch (kind) {
    case 'source': // a page: the provider's own text
      return (
        <svg {...common}>
          <rect x="1.5" y="0.5" width="9" height="11" rx="1" fill="none" stroke="currentColor" />
          <path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke="currentColor" />
        </svg>
      );
    case 'deterministic': // a hash mark: computed, reproducible
      return (
        <svg {...common}>
          <path d="M4 1 3 11M9 1 8 11M1 4h10M1 8h10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'analysis': // an open diamond: inference, not fact
      return (
        <svg {...common}>
          <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill="none" stroke="currentColor" strokeDasharray="2 1.2" />
        </svg>
      );
    case 'human': // a person
      return (
        <svg {...common}>
          <circle cx="6" cy="3.5" r="2.3" fill="currentColor" />
          <path d="M1.5 11.5c0-2.6 2-4.2 4.5-4.2s4.5 1.6 4.5 4.2" fill="currentColor" />
        </svg>
      );
  }
}

export function ProvenanceTag({ kind, children }: { kind: ProvenanceKind; children?: ReactNode }) {
  return (
    <span className={`ist-prov ist-prov--${kind}`} title={DESCRIPTIONS[kind]}>
      <Glyph kind={kind} />
      {children ?? LABELS[kind]}
    </span>
  );
}

/** A block of content that belongs to one provenance layer, marked by a left rule and a tag. */
export function ProvenanceBlock({
  kind,
  label,
  aside,
  children,
}: {
  kind: ProvenanceKind;
  label?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`ist-layer ist-layer--${kind}`}>
      <div className="ist-row" style={{ justifyContent: 'space-between', marginBlockEnd: 8 }}>
        <ProvenanceTag kind={kind}>{label}</ProvenanceTag>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function ProvenanceLegend() {
  return (
    <div className="ist-legend" aria-label="Provenance legend">
      {(['source', 'deterministic', 'analysis', 'human'] as const).map((k) => (
        <ProvenanceTag key={k} kind={k} />
      ))}
    </div>
  );
}
