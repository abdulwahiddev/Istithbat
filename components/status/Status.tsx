import type { ReactNode } from 'react';

/**
 * Release-state and health badges. Each pairs a glyph shape, a word and a colour
 * (design system P4: meaning never rides on colour alone).
 */

type Tone = 'trusted' | 'pending' | 'blocked' | 'muted' | 'analysis';

function Glyph({ shape }: { shape: 'check' | 'dashed' | 'bar' | 'cross' | 'ring' | 'dot' }) {
  const c = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true } as const;
  switch (shape) {
    case 'check':
      return (
        <svg {...c}>
          <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="currentColor" opacity="0.25" stroke="currentColor" />
          <path d="M3 6.2 5.2 8.4 9.2 3.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'dashed':
      return (
        <svg {...c}>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeDasharray="2.2 1.6" />
        </svg>
      );
    case 'bar':
      return (
        <svg {...c}>
          <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" />
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'cross':
      return (
        <svg {...c}>
          <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" />
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'ring':
      return (
        <svg {...c}>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" />
        </svg>
      );
    case 'dot':
      return (
        <svg {...c}>
          <circle cx="6" cy="6" r="4" fill="currentColor" />
        </svg>
      );
  }
}

function Badge({ tone, shape, children, dashed, title }: { tone: Tone; shape: Parameters<typeof Glyph>[0]['shape']; children: ReactNode; dashed?: boolean; title?: string }) {
  return (
    <span className={`ist-badge ist-badge--${tone}${dashed ? ' ist-badge--dashed' : ''}`} title={title}>
      <Glyph shape={shape} />
      {children}
    </span>
  );
}

export type VersionStatusValue = 'PENDING' | 'ANALYZING' | 'QUARANTINED' | 'TRUSTED' | 'REJECTED' | 'SUPERSEDED';

/**
 * ANALYZING means "not released and not quarantined" (Bible App. A). When policy has applied
 * REVIEW the UI says "Held for review" (D-04); either way the version is never shown as served.
 */
export function VersionStatusBadge({ status, heldForReview }: { status: VersionStatusValue; heldForReview?: boolean }) {
  switch (status) {
    case 'TRUSTED':
      return <Badge tone="trusted" shape="check">Trusted</Badge>;
    case 'ANALYZING':
      return heldForReview ? (
        <Badge tone="pending" shape="dashed" dashed title="REVIEW: untrusted and unserved until a human approves">
          Held for review
        </Badge>
      ) : (
        <Badge tone="pending" shape="dashed" dashed title="Not released, not quarantined; investigation in progress">
          Untrusted · analysing
        </Badge>
      );
    case 'QUARANTINED':
      return <Badge tone="blocked" shape="bar" title="Contained: stored and inspectable, never served">Quarantined</Badge>;
    case 'REJECTED':
      return <Badge tone="blocked" shape="cross">Rejected</Badge>;
    case 'SUPERSEDED':
      return <Badge tone="muted" shape="ring">Superseded</Badge>;
    case 'PENDING':
      return <Badge tone="muted" shape="dashed" dashed>Pending</Badge>;
  }
}

export function ConnectorHealthBadge({ health }: { health: string }) {
  const h = health.toUpperCase();
  if (h === 'HEALTHY') return <Badge tone="trusted" shape="dot">Connector healthy</Badge>;
  if (h === 'DEGRADED') return <Badge tone="pending" shape="dashed" dashed>Connector degraded</Badge>;
  if (h === 'UNAVAILABLE' || h === 'FAILED') return <Badge tone="blocked" shape="cross">Connector unavailable</Badge>;
  return <Badge tone="muted" shape="ring">Connector {health.toLowerCase()}</Badge>;
}

const LEVEL_TEXT: Record<string, string> = {
  A: 'Level A · stable foundational',
  B: 'Level B · explanation / inference',
  C: 'Level C · disputed / high sensitivity',
};
export function ContentLevelTag({ level }: { level: string }) {
  return (
    <span className="ist-tag" title="Declared by the connector (D-03); never assigned by AI">
      {LEVEL_TEXT[level] ?? `Level ${level}`}
    </span>
  );
}

const ROLE_TEXT: Record<string, string> = {
  AUTHORITATIVE_TEXT: 'Authoritative text',
  SCHOLAR_JUDGMENT: 'Scholar judgment',
  PROVENANCE: 'Provenance',
  TRANSLATION: 'Translation',
  COMMENTARY: 'Commentary',
  OPERATIONAL_METADATA: 'Operational metadata',
  UNCLASSIFIED: 'Unclassified',
};
const SENSITIVE_ROLES = new Set(['AUTHORITATIVE_TEXT', 'SCHOLAR_JUDGMENT']);

export function FieldRoleTag({ role }: { role: string | null }) {
  if (!role) return <span className="ist-tag">—</span>;
  return (
    <span
      className="ist-tag"
      style={SENSITIVE_ROLES.has(role) ? { borderColor: 'var(--border-strong)', color: 'var(--text-primary)' } : undefined}
      title="Field role declared by the connector (D-02)"
    >
      {ROLE_TEXT[role] ?? role}
    </span>
  );
}

const FLAG_TEXT: Record<string, { text: string; equivalent: boolean }> = {
  WHITESPACE_ONLY: { text: 'Whitespace only · equivalent', equivalent: true },
  UNICODE_EQUIVALENT: { text: 'Unicode-equivalent (NFC) · equivalent', equivalent: true },
  HARAKAT_ONLY: { text: 'Harakat only · substantive', equivalent: false },
  PUNCTUATION_ONLY: { text: 'Punctuation only · substantive', equivalent: false },
};
export function DiffFlagTag({ flag }: { flag: string }) {
  const f = FLAG_TEXT[flag] ?? { text: flag, equivalent: false };
  return <Badge tone={f.equivalent ? 'muted' : 'pending'} shape={f.equivalent ? 'ring' : 'bar'}>{f.text}</Badge>;
}

export function SilentMutationBadge() {
  return (
    <Badge tone="blocked" shape="bar" title="Same upstream label, different content fingerprint. Cause unknown.">
      Silent mutation
    </Badge>
  );
}
