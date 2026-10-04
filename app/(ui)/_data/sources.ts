import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceDetail, SourceSummary } from '@/lib/contracts';
import { stableStringify } from '@/lib/ai/hash';

/**
 * UI data adapter for Sources / Source Detail.
 *
 * TEMPORARY: Codex's lib/contracts defines SourceSummary/SourceDetail, but no read endpoint or
 * server query exists yet. Until it does, this returns PREVIEW data built from the real synthetic
 * fixture files and typed against the real contracts. Every preview is labelled in the UI.
 *
 * Swap point: replace previewSources()/previewDetail() with the Codex query or GET endpoint.
 * Waiting on: GET /api/sources, GET /api/sources/{id} (or server functions), plus the
 * SourceVersion/SourceDetail additions listed in docs/HANDOFF.md.
 */

type ContractVersion = SourceDetail['versions'][number];
type ContractChange = SourceDetail['changes'][number];

/** Fields the UI needs that the current contract does not carry yet (requested from Codex). */
export interface VersionExtras {
  upstreamPublishedAt?: string | null;
  /** D-04: ANALYZING after policy REVIEW is displayed "Held for review". */
  heldForReview?: boolean;
  /** D-14: raw hash differs, canonical hash equal. */
  changeClass?: 'SERIALIZATION_ONLY' | null;
  /** POL-005 deterministic fast path, with which equivalence applied. */
  autoPromotion?: {
    policyCode: 'POL-005';
    equivalence: 'METADATA_ONLY' | 'WHITESPACE_ONLY' | 'UNICODE_EQUIVALENT' | 'SERIALIZATION_ONLY';
    promotedAt: string;
  } | null;
}
export type VersionView = ContractVersion & VersionExtras;

export interface TransitionView {
  fromVersionId: string;
  toVersionId: string;
  changes: ContractChange[];
}

export interface SourceDetailView {
  source: SourceSummary;
  fieldRoles: SourceDetail['fieldRoles'];
  versions: VersionView[];
  transitions: TransitionView[];
  origin: 'live' | 'preview';
}

export const PREVIEW_SCENARIOS = ['baseline', 'v14', 'v14-r2', 'pol-005'] as const;
export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number];
export const SCENARIO_LABELS: Record<PreviewScenario, string> = {
  baseline: 'v13 trusted',
  v14: 'v14 published',
  'v14-r2': 'v14-r2 silent mutation',
  'pol-005': 'POL-005 auto-promotion',
};

// ---------------------------------------------------------------- preview construction

const SANDBOX_ID = 'hadith-evidence-sandbox';
const FIELD_ROLES: SourceDetail['fieldRoles'] = {
  arabic_text: 'AUTHORITATIVE_TEXT',
  translation: 'TRANSLATION',
  judgment: 'SCHOLAR_JUDGMENT',
  scholar: 'PROVENANCE',
  'reference.book': 'PROVENANCE',
  'reference.volume': 'PROVENANCE',
  'reference.page': 'PROVENANCE',
  'narrators[]': 'PROVENANCE',
  updated_at: 'OPERATIONAL_METADATA',
  display_label: 'OPERATIONAL_METADATA',
  source_url: 'OPERATIONAL_METADATA',
  internal_id: 'OPERATIONAL_METADATA',
  description: 'OPERATIONAL_METADATA',
};

function fixture(name: string): Buffer {
  return readFileSync(join(process.cwd(), 'demo', 'synthetic-fixtures', name));
}
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
// Preview only: the real canonical hash comes from lib/hashing (D-14, Codex).
const previewCanonical = (b: Buffer) => sha(stableStringify(JSON.parse(b.toString('utf8'))));

function version(id: string, label: string, rev: number, bytes: Buffer, status: ContractVersion['status'], detectedAt: string, extras: VersionExtras & { silentMutation?: boolean } = {}): VersionView {
  const { silentMutation = false, ...rest } = extras;
  return {
    id,
    upstreamLabel: label,
    revisionNumber: rev,
    status,
    rawSha256: sha(bytes),
    canonicalSha256: previewCanonical(bytes),
    silentMutation,
    detectedAt,
    ...rest,
  };
}

function summary(seen: string, trusted: string, served: string): SourceSummary {
  return {
    id: SANDBOX_ID,
    name: 'Hadith Evidence Sandbox',
    provider: 'Istithbat synthetic demo infrastructure',
    sourceType: 'HADITH_EVIDENCE',
    connectorHealth: 'HEALTHY',
    isDemoFixture: true,
    contentLevel: 'A',
    latestSeenLabel: seen,
    trustedLabel: trusted,
    servedLabel: served,
  };
}

function previewDetail(scenario: PreviewScenario): SourceDetailView {
  const v13b = fixture('had-4821.v13.json');
  const v14b = fixture('had-4821.v14.json');
  const v14r2b = fixture('had-4821.v14-r2.json');

  const v13 = version('pv-v13-r1', 'v13', 1, v13b, 'TRUSTED', '2026-10-04T06:00:00Z', { upstreamPublishedAt: '2026-09-01T00:00:00Z' });
  const base = { source: summary('v13', 'v13', 'v13'), fieldRoles: FIELD_ROLES, origin: 'preview' as const };

  if (scenario === 'baseline') return { ...base, versions: [v13], transitions: [] };

  if (scenario === 'pol-005') {
    // FMT-03 / SM-02 shape: same label, keys re-ordered → raw hash differs, canonical equal.
    const parsed = JSON.parse(v13b.toString('utf8')) as Record<string, unknown>;
    const reversedTopLevel = Object.fromEntries(Object.entries(parsed).reverse());
    const reordered = Buffer.from(`${JSON.stringify(reversedTopLevel, null, 2)}\n`);
    const v13r2 = version('pv-v13-r2', 'v13', 2, reordered, 'TRUSTED', '2026-10-04T07:10:00Z', {
      upstreamPublishedAt: '2026-09-01T00:00:00Z',
      silentMutation: true,
      changeClass: 'SERIALIZATION_ONLY',
      autoPromotion: { policyCode: 'POL-005', equivalence: 'SERIALIZATION_ONLY', promotedAt: '2026-10-04T07:10:02Z' },
    });
    return {
      ...base,
      source: summary('v13', 'v13', 'v13'),
      versions: [{ ...v13, status: 'SUPERSEDED' }, v13r2],
      transitions: [{ fromVersionId: v13.id, toVersionId: v13r2.id, changes: [] }],
    };
  }

  const v14 = version('pv-v14-r1', 'v14', 1, v14b, 'ANALYZING', '2026-10-04T09:02:00Z', { upstreamPublishedAt: '2026-10-04T00:00:00Z' });
  const judgmentChange: ContractChange = {
    id: 'pv-chg-1',
    canonicalKey: 'HAD-4821',
    changeType: 'FIELD_MODIFIED',
    fieldPath: 'judgment',
    fieldRole: 'SCHOLAR_JUDGMENT',
    oldValue: 'إسناده صحيح',
    newValue: 'صحيح',
    flags: [],
  };
  if (scenario === 'v14') {
    return {
      ...base,
      source: summary('v14', 'v13', 'v13'),
      versions: [v13, v14],
      transitions: [{ fromVersionId: v13.id, toVersionId: v14.id, changes: [judgmentChange] }],
    };
  }

  const v14r2 = version('pv-v14-r2', 'v14', 2, v14r2b, 'ANALYZING', '2026-10-04T09:20:00Z', {
    upstreamPublishedAt: '2026-10-04T00:00:00Z',
    silentMutation: true,
  });
  return {
    ...base,
    source: summary('v14', 'v13', 'v13'),
    versions: [v13, v14, v14r2],
    transitions: [
      { fromVersionId: v13.id, toVersionId: v14.id, changes: [judgmentChange] },
      {
        fromVersionId: v14.id,
        toVersionId: v14r2.id,
        changes: [
          { id: 'pv-chg-2', canonicalKey: 'HAD-4821', changeType: 'FIELD_MODIFIED', fieldPath: 'reference.page', fieldRole: 'PROVENANCE', oldValue: 12, newValue: 13, flags: [] },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------- public API

export function parseScenario(value: string | string[] | undefined): PreviewScenario {
  const v = Array.isArray(value) ? value[0] : value;
  return (PREVIEW_SCENARIOS as readonly string[]).includes(v ?? '') ? (v as PreviewScenario) : 'v14-r2';
}

export async function loadSources(scenario: PreviewScenario): Promise<{ sources: SourceSummary[]; origin: 'live' | 'preview' }> {
  return { sources: [previewDetail(scenario).source], origin: 'preview' };
}

export async function loadSourceDetail(sourceId: string, scenario: PreviewScenario): Promise<SourceDetailView | null> {
  if (sourceId !== SANDBOX_ID) return null;
  return previewDetail(scenario);
}
