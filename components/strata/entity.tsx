import type { CSSProperties } from 'react';
import { Icon, type IconName } from './icons';

/** Entity identity in graphs and lineage: one Lucide glyph per asset type (shape is never the identity). */
export const ENTITY_ICON: Record<string, IconName> = {
  SOURCE: 'database', RECORD: 'file-text', DATASET: 'table-2', RAG_CHUNK: 'layers-2', KNOWLEDGE_INDEX: 'search',
  API: 'braces', APPLICATION: 'app-window', MIXED: 'layers',
};
export const entityIcon = (t: string): IconName => ENTITY_ICON[t] ?? 'layers';

export type StateKey = 'impacted' | 'exposed' | 'stale' | 'healthy' | 'changed' | 'neutral';
export const STATE_COLOR: Record<StateKey, string> = { impacted: 'var(--co)', changed: 'var(--co)', exposed: 'var(--am)', stale: 'var(--am)', healthy: 'var(--tq)', neutral: 'var(--ink-4)' };
export const stateKey = (impact: string): StateKey =>
  impact === 'IMPACTED' ? 'impacted' : impact === 'STALE' ? 'stale' : impact === 'HEALTHY' ? 'healthy' : impact === 'EXPOSED' ? 'exposed' : 'neutral';

/**
 * Status mark for chips and tables. Filled for impacted / exposed / healthy / neutral; a solid ring
 * for stale (a hollow mark reads as "superseded copy" without colour, and never renders as a
 * broken dashed fragment at 8px).
 */
export function StateMark({ s, style }: { s: StateKey; style?: CSSProperties }) {
  return <span className={`stm stm-${s}`} style={style} aria-hidden="true" />;
}

export function EntityIcon({ type, size = 15, style }: { type: string; size?: number; style?: CSSProperties }) {
  return <Icon name={entityIcon(type)} size={size} style={style} />;
}
