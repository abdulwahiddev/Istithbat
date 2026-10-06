/** Walkthrough facts, derived on the server from the chrome's own incident and binding lists. */
export type GuideData = {
  incidentId: string | null;
  /** Labels of the lead held incident; candidate is null when nothing is held. */
  candidate: string | null; trusted: string | null; served: string | null;
  gatewayHref: string;
};
/** Guide facts from the chrome's own data (lead held incident first). */
export function guideFrom(c: { incidents: { id: string; candidateLabel: string; trustedLabel: string | null; servedLabel: string | null; status: string; needsDecision: boolean }[]; served: { trustedLabel: string | null; servedLabel: string | null } | null; gatewayHref: string }): GuideData {
  const lead = c.incidents[0];
  const held = lead && (lead.status === 'QUARANTINED' || lead.needsDecision);
  return {
    incidentId: lead?.id ?? null,
    candidate: held ? lead.candidateLabel : null,
    trusted: lead?.trustedLabel ?? c.served?.trustedLabel ?? null,
    served: lead?.servedLabel ?? c.served?.servedLabel ?? null,
    gatewayHref: c.gatewayHref,
  };
}

/**
 * Which stop the user is on, from the real location. Any incident's review, decision and Blast
 * Radius routes count, not only the canonical one; pages outside the seven stops return -1.
 */
export function currentIndex(path: string, hash: string): number {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/sandbox' || p.startsWith('/sandbox/')) return 1;
  if (p === '/overview') return hash === '#flow' ? 2 : 0;
  if (/^\/incidents\/[^/]+\/blast-radius$/.test(p)) return 4;
  if (/^\/incidents\/[^/]+$/.test(p)) return hash === '#decision' ? 5 : 3;
  if (p === '/gateway' || p.startsWith('/gateway/')) return 6;
  return -1;
}

