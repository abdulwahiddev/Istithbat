import { describe, expect, it } from 'vitest';
import { currentIndex, guideFrom } from '../strata/guide-data';

const ID = '863d5b03-fc98-4d49-a2a6-ae9d6c3cf753';

describe('guided tour step detection', () => {
  it('maps each of the seven stops, including hash stops and dynamic incident routes', () => {
    expect(currentIndex('/overview', '')).toBe(0);
    expect(currentIndex('/sandbox', '')).toBe(1);
    expect(currentIndex('/overview', '#flow')).toBe(2);
    expect(currentIndex(`/incidents/${ID}`, '')).toBe(3);
    expect(currentIndex(`/incidents/${ID}`, '#source')).toBe(3);
    expect(currentIndex(`/incidents/${ID}/blast-radius`, '')).toBe(4);
    expect(currentIndex(`/incidents/${ID}`, '#decision')).toBe(5);
    expect(currentIndex('/gateway/islamic-qa-demo', '')).toBe(6);
    expect(currentIndex('/gateway', '')).toBe(6);
  });
  it('tolerates a trailing slash and treats other pages as off-tour', () => {
    expect(currentIndex('/overview/', '')).toBe(0);
    expect(currentIndex(`/incidents/${ID}/blast-radius/`, '')).toBe(4);
    for (const p of ['/', '/sources', '/incidents', `/incidents/${ID}/record`, '/lab']) expect(currentIndex(p, '')).toBe(-1);
  });
});

describe('guided tour state line data', () => {
  it('carries the held labels, or nothing when the incident list is empty', () => {
    const held = guideFrom({ incidents: [{ id: ID, candidateLabel: 'v14', trustedLabel: 'v13', servedLabel: 'v13', status: 'QUARANTINED', needsDecision: true }], served: null, gatewayHref: '/gateway/x' });
    expect(held).toMatchObject({ incidentId: ID, candidate: 'v14', trusted: 'v13', served: 'v13' });
    const empty = guideFrom({ incidents: [], served: null, gatewayHref: '/gateway' });
    expect(empty).toMatchObject({ incidentId: null, candidate: null, trusted: null, served: null });
  });
});
