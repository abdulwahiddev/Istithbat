/** Serializable view of one source for the Sources screen (built on the server from the contracts). */
export type Stage = { main: string; sub: string; dot: string; line: string; lineStyle: 'solid' | 'dashed'; mono?: boolean };
export type SourceView = {
  id: string; tab: string; name: string; provider: string; kind: string; synthetic: boolean; records: string;
  stages: Stage[]; chips: { label: string; tone: string }[]; sentence: string;
  latest: string; trusted: string; served: string; changed: string;
  connector: string; scope: string; keys: string; level: string;
  strategy: string; revision: string; silent: string; raw: string; canon: string;
  checks: { when: string; title: string; note: string; code: string; mk: string }[];
  termsLabel: string; terms: string; endpoint: string;
  held: { incidentId: string; label: string } | null;
};

/** "background:var(--tq)" → React style object. */
export function css(s: string): Record<string, string> {
  return Object.fromEntries(s.split(';').filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    const k = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return [k.startsWith('--') ? d.slice(0, i).trim() : k, d.slice(i + 1).trim()];
  }));
}
