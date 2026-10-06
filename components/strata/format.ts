/**
 * Presentation formatting shared by every Strata screen. Pure; identical on server and client
 * (all times are rendered in UTC so server and hydrated markup never disagree).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function parts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getUTCDate(), mon: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` };
}

/** "4 Oct, 00:00:12" — key/value rows. */
export function dayTime(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? `${p.day} ${p.mon}, ${p.time}` : '—';
}

/** "4 Oct 00:00:47" — event rows. */
export function evTime(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? `${p.day} ${p.mon} ${p.time}` : '—';
}

/** "4 Oct 2026" */
export function dayYear(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? `${p.day} ${p.mon} ${p.year}` : '—';
}

/** "4 Oct 2026 · 00:00:12" */
export function fullTime(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? `${p.day} ${p.mon} ${p.year} · ${p.time}` : '—';
}

/** "00:00:12" */
export function clock(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? p.time : '—';
}

/** Hash shortened as first 8 … last 4 (handoff §11). */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

/** "v14 · r1" */
export const vr = (label: string, revision: number) => `${label} · r${revision}`;

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Seven" for headlines; digits above twelve. */
export const word = (n: number) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
export const lowerWord = (n: number) => word(n).toLowerCase();

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "SCOPE_BROADENING" → "Scope broadening" */
export const humanize = (value: string) => {
  const s = value.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "HIGH" → "High" */
export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * Version labels. A provider that publishes no version label is stored with the literal upstream
 * label 'unversioned' (lib/connectors UNVERSIONED_LABEL); Istithbat still numbers each observed state
 * r1, r2, … For those sources the revision alone is the label, at the same weight as `v13` or
 * `1.1.2 · r1`, and `REVISION_NOTE` explains it in a tooltip / accessible name. Provider labels are
 * never replaced. Presentation only: the stored label, revision and Silent Mutation rules are unchanged.
 */
export const UNVERSIONED = 'unversioned';
export const isUnversioned = (label: string | null | undefined) => label === UNVERSIONED;
export const REVISION_NOTE = 'Istithbat revision · upstream publishes no version label';
/**
 * `always`: provider label · rN (lineage, record). `needed`: label rN only from r2 (graph, regression).
 * `label`: the provider label alone (badges, sentences). Unversioned providers show rN in every mode.
 */
export function versionText(label: string | null | undefined, revision: number | null | undefined, rev: 'always' | 'needed' | 'label' = 'always'): string {
  if (label == null) return '—';
  if (isUnversioned(label)) return revision != null ? `r${revision}` : '—';
  if (rev === 'label' || revision == null || (rev === 'needed' && revision <= 1)) return label;
  return rev === 'needed' ? `${label} r${revision}` : `${label} · r${revision}`;
}
/** Tooltip / aria text for a displayed version, only where the label is an Istithbat revision. */
export const versionHint = (label: string | null | undefined) => (isUnversioned(label) ? REVISION_NOTE : undefined);
