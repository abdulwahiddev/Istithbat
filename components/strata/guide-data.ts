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
