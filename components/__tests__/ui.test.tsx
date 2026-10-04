import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IncidentAggregate, SourceDetail } from '@/lib/contracts';
import { releaseRefs, silentMutationPairs, transitions, versionName } from '../sources/derive';
import { pipelineStages, stagesForIncident, stateFromSteps } from '../incidents/pipeline';
import { readAnalysisOutput, readContextPacket, contextElementKinds } from '../incidents/context';
import { DeterministicEvidence, IncidentTable, MachineAnalysis, PipelineTrack } from '../incidents/IncidentViews';
import { SourceChecks, TransitionChanges } from '../sources/SourceViews';
import sourceJson from './fixtures/source-detail.live.json';
import r1Json from './fixtures/incident-v14-r1.live.json';
import r2Json from './fixtures/incident-v14-r2.live.json';

// The shared vitest config compiles JSX with the classic runtime; components expect React in scope.
(globalThis as unknown as { React: typeof React }).React = React;

// Fixtures are verbatim responses from the production read API (GET /api/sources/{id},
// GET /api/incidents/{id}) after the v13 → v14 → v14-r2 controlled sequence. Parsing them with
// the published contracts proves the UI is built against the real shapes.
const source = SourceDetail.parse(sourceJson);
const r1 = IncidentAggregate.parse(r1Json);
const r2 = IncidentAggregate.parse(r2Json);

describe('source detail derivations (real Packet 02 data)', () => {
  it('keeps latest seen, trusted and served distinct', () => {
    const refs = releaseRefs(source);
    expect(refs.seen).toEqual({ label: 'v14', revision: 2 });
    expect(refs.trusted).toEqual({ label: 'v13', revision: 1 });
    expect(refs.served).toEqual({ label: 'v13', revision: 1 });
  });

  it('groups changes by persisted transition, newest first', () => {
    const t = transitions(source);
    expect(t.map((x) => `${x.from && versionName(x.from)}→${versionName(x.to)}`)).toEqual(['v14 r1→v14 r2', 'v13 r1→v14 r1']);
    expect(t[0].changes.map((c) => c.fieldPath)).toEqual(['reference.page']);
    expect(t[1].changes.map((c) => c.fieldPath)).toEqual(['judgment']);
  });

  it('pairs the v14-r2 silent mutation with v14 r1', () => {
    const pairs = silentMutationPairs(source.versions);
    expect(pairs).toHaveLength(1);
    expect(versionName(pairs[0].before)).toBe('v14 r1');
    expect(versionName(pairs[0].after)).toBe('v14 r2');
    expect(pairs[0].before.rawSha256).not.toBe(pairs[0].after.rawSha256);
  });

  it('renders the Arabic judgment exactly, RTL, with its role', () => {
    const html = renderToStaticMarkup(<TransitionChanges transition={transitions(source)[1]} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('إسناده صحيح');
    expect(html).toContain('>صحيح<');
    expect(html).toContain('Scholar judgment');
    expect(html).toContain('v13 r1 · trusted');
  });

  it('renders source checks including the NO_CHANGE recheck', () => {
    const html = renderToStaticMarkup(<SourceChecks checks={source.checks ?? []} versions={source.versions} />);
    expect(html).toContain('No change (identical bytes)');
    expect(html).toContain('New version stored');
  });
});

describe('pipeline stage mapping', () => {
  it('maps real Packet 03 state without claiming future stages', () => {
    const stages = stagesForIncident(r1);
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.state]));
    expect(byKey).toEqual({
      CONNECT: 'complete',
      DETECT: 'complete',
      UNDERSTAND: 'complete',
      TEST: 'next',
      TRACE: 'pending',
      CONTAIN: 'pending',
      DECIDE: 'not-reached',
    });
  });

  it('distinguishes failed, retryable, running, partial and unscheduled steps', () => {
    const step = (status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED', errorCode: string | null = null, s = 'ANALYSIS') => ({
      step: s as 'ANALYSIS', itemKey: '', status, attempts: 1, errorCode, outputRef: null, startedAt: null, completedAt: null,
    });
    expect(stateFromSteps([step('FAILED', 'AI_ANALYSIS_FAILED')], null)).toBe('failed');
    expect(stateFromSteps([step('PENDING', 'AI_ANALYSIS_FAILED')], 'ANALYSIS')).toBe('retryable');
    expect(stateFromSteps([step('RUNNING')], null)).toBe('active');
    expect(stateFromSteps([step('DONE'), step('PENDING', null, 'REGRESSION_PAIR')], null)).toBe('active');
    expect(stateFromSteps([], null)).toBe('not-scheduled');
    const fast = pipelineStages({ hasCandidateSnapshot: true, changeCount: 0, silentMutation: false, steps: [step('PENDING', null, 'POLICY')], nextStep: 'POLICY', reviewCount: 0 });
    expect(fast.find((s) => s.key === 'UNDERSTAND')?.state).toBe('not-scheduled');
    expect(fast.find((s) => s.key === 'CONTAIN')?.state).toBe('next');
  });

  it('renders stage states as text, not colour alone', () => {
    const html = renderToStaticMarkup(<PipelineTrack stages={stagesForIncident(r2)} />);
    expect(html).toContain('Complete');
    expect(html).toContain('Not reached');
    expect(html).toContain('aria-label="Test: Next.');
  });
});

describe('incident evidence and analysis (real Packet 03 data)', () => {
  it('shows the v14-r2 silent mutation as same label, different content, reference.page 12 → 13', () => {
    const html = renderToStaticMarkup(<DeterministicEvidence inc={r2} packet={readContextPacket(r2.contextPacket)} />);
    expect(html).toContain('Same upstream label');
    expect(html).toContain('reference.page');
    expect(html).toMatch(/>12</);
    expect(html).toMatch(/>13</);
    expect(html).toContain('Provenance');
    expect(html).toContain('v14 r1 · untrusted previous');
  });

  it('shows the v14 judgment change against trusted v13', () => {
    const packet = readContextPacket(r1.contextPacket);
    expect(contextElementKinds(packet)).toContain('SYNTHETIC_MUTATION');
    const html = renderToStaticMarkup(<DeterministicEvidence inc={r1} packet={packet} />);
    expect(html).toContain('إسناده صحيح');
    expect(html).toContain('v13 r1 · trusted');
    expect(html).toContain(r1.contextPacketHash);
  });

  it('labels mock analysis unmistakably and keeps it advisory', () => {
    expect(readAnalysisOutput(r1.analysis?.output)).not.toBeNull();
    const html = renderToStaticMarkup(<MachineAnalysis inc={r1} />);
    expect(html).toContain('AI analysis · mock mode');
    expect(html).toContain('AI analysis — mock mode');
    expect(html).toContain('Advice only. Policy has not yet been evaluated.');
    expect(html).toContain('Analysed context hash matches this incident');
    expect(html).not.toContain('live model');
  });

  it('labels replay with its recording time and shows analysis failure without hiding evidence', () => {
    const replay = { ...r1, analysis: { ...r1.analysis!, meta: { ...r1.analysis!.meta, mode: 'replay' as const, recordedAt: '2026-10-05T18:00:00.000Z' } } };
    expect(renderToStaticMarkup(<MachineAnalysis inc={replay} />)).toContain('Replayed response (recorded 2026-10-05 18:00 UTC)');
    const failed = {
      ...r1,
      analysis: null,
      pipelineSteps: r1.pipelineSteps.map((s) => (s.step === 'ANALYSIS' ? { ...s, status: 'FAILED' as const, attempts: 2, errorCode: 'AI_ANALYSIS_FAILED' } : s)),
    };
    const html = renderToStaticMarkup(<MachineAnalysis inc={failed} />);
    expect(html).toContain('Analysis unavailable: AI_ANALYSIS_FAILED');
    expect(html).toContain('deterministic evidence above is unaffected');
  });

  it('renders the incident list from real items', () => {
    const items = [r2, r1].map((d) => ({
      item: {
        id: d.id, sourceId: d.sourceId, candidateVersionId: d.candidateVersion.id, status: d.status, riskLevel: d.riskLevel, title: d.title,
        summary: d.summary, openedAt: '2026-10-04T11:43:15.497Z', pipelineStatus: d.pipeline?.status ?? null, nextStep: d.pipeline?.nextStep ?? null,
        silentMutation: d.candidateVersion.silentMutation, analysisMode: d.analysis?.meta.mode ?? null,
      },
      detail: d,
    }));
    const html = renderToStaticMarkup(<IncidentTable rows={items} />);
    expect(html).toContain('v14 r2');
    expect(html).toContain('v14 r1');
    expect(html).toContain('Silent mutation');
    expect(html).toContain('judgment');
    expect(html).toContain('reference.page');
    expect(html).toContain('3/7 stages complete');
    expect(html).toContain('AI analysis · mock mode');
  });
});
