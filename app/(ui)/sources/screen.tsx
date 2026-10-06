import { getT, readReviewer } from '../_data/session';
import { notFound } from 'next/navigation';
import { SourcesScreen } from '@/components/sources/SourcesScreen';
import type { SourceView } from '@/components/sources/types';
import { plural, word } from '@/components/strata/format';
import { Chip, Dk, HandedToYou, PageHeader, ReadError, ReviewerStatus, Sep, SummaryDock } from '@/components/strata/primitives';
import { readGatewayInventory, readSourceDetail, readSources } from '../_data/read';
import { sourceModel, vl } from '../_data/source-model';
import { sourceView } from '../_data/source-view';

/** Shared by /sources and /sources/{id}: the same screen with that source selected (handoff §2). */
export async function SourcesPage({ selectedId }: { selectedId?: string }) {
  const reviewer = await readReviewer();
  const t = await getT();
  const sources = await readSources();
  const gateway = await readGatewayInventory();
  if (!sources.ok) {
    return <main id="main" className="scr-sources"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...sources.error} /></div></section></main>;
  }
  const items = gateway.ok ? gateway.data : [];
  const views: SourceView[] = [];
  const models = [];
  const ordered = [...sources.data].sort((a, b) => Number(items.some((i) => i.sourceId === b.id && i.binding)) - Number(items.some((i) => i.sourceId === a.id && i.binding)) || a.name.localeCompare(b.name));
  for (const s of ordered) {
    const d = await readSourceDetail(s.id);
    const m = sourceModel(s, items, d.ok ? d.data : null);
    models.push(m);
    views.push(sourceView(m, d.ok ? d.data : null));
  }
  if (selectedId && !views.some((v) => v.id === selectedId)) notFound();
  const held = models.filter((m) => m.state === 'held');
  const initial = selectedId ?? held[0]?.summary.id ?? models.find((m) => m.bound)?.summary.id ?? views[0]?.id ?? '';
  const real = models.filter((m) => m.facts.real).length, synth = models.length - real;
  const healthy = models.filter((m) => m.summary.connectorHealth === 'HEALTHY').length;
  const records = models.reduce((n, m) => n + (m.recordCount ?? 0), 0);
  const changed = models.filter((m) => m.changed).length;
  const realAgree = models.filter((m) => m.facts.real && m.state === 'agreement').length;
  const lede = [
    healthy === models.length ? 'Every connector is healthy.' : `${word(models.length - healthy)} ${models.length - healthy === 1 ? 'connector is' : 'connectors are'} not healthy.`,
    real ? (realAgree === real ? `${real === 2 ? 'Both' : real === 1 ? 'The' : 'All'} real ${real === 1 ? 'source matches its' : 'sources match their'} trusted baseline.` : `${word(real - realAgree)} real ${real - realAgree === 1 ? 'source differs' : 'sources differ'} from the trusted baseline.`) : '',
    held.length ? `${word(held.length)} ${held.some((m) => !m.facts.real) ? 'synthetic ' : ''}${held.length === 1 ? 'candidate is' : 'candidates are'} held.` : 'Nothing is held.',
  ].filter(Boolean).join(' ');
  const leadHeld = held[0];

  return (
    <main id="main" className="scr-sources">
      <PageHeader
        crumbs={<><span>{t('Sources')}</span><Sep /><span>{t('{n} connectors · {r} records', { n: models.length, r: records })}</span></>}
        title={<>{t(models.length === 1 ? '1 source monitored.' : '{n} sources monitored.', { n: models.length })}<br />{real && synth ? t('{r} real, {s} synthetic.', { r: real, s: synth }) : t(real ? 'All real.' : 'All synthetic.')}</>}
        lede={lede.split(/(?<=\.) /).map((x) => t(x)).join(' ')}
        status={<>
          <Dk k={t('Connectors')}><Chip tone={healthy === models.length ? 'tq' : 'am'}>{t('{h} of {n} healthy', { h: healthy, n: models.length })}</Chip></Dk>
          <Dk k={t('Records monitored')}>{records}</Dk>
          <Dk k={t('Changed since baseline')}>{changed ? <Chip tone="co">{t(changed === 1 ? '1 source' : '{n} sources', { n: changed })}</Chip> : <Chip tone="tq">{t('None')}</Chip>}</Dk>
        </>}
      />
      <SourcesScreen views={views} initialId={initial} />
      {leadHeld ? (
        <SummaryDock
          railText={`Sources never decide. The held ${leadHeld.facts.title} candidate waits for a signature.`}
          left={<Chip tone="co">{leadHeld.facts.title} <span className="mono">{vl(leadHeld.latest)}</span> held</Chip>}
          right={<ReviewerStatus active={!!reviewer} />}
          question={held.length === 1 ? 'One source has a candidate waiting.' : `${word(held.length)} sources have candidates waiting.`}
          body={models.filter((m) => m.state === 'agreement').length ? `${models.filter((m) => m.state === 'agreement').map((m) => m.facts.title).join(' and ')} need nothing: they match their trusted baselines.` : 'Every other source needs a look as well.'}
          href={`/incidents/${leadHeld.held!.incidentId}#decision`} cta={`Review the ${leadHeld.facts.title} change`}
          helper={leadHeld.held?.policyAction === 'QUARANTINE' ? 'Policy requires a human for this change' : 'Held for review until a person decides'}
        />
      ) : (
        <SummaryDock
          railText="Sources never decide. Nothing is waiting for a signature."
          left={<Chip tone="tq">Every source matches its baseline</Chip>} right={<HandedToYou>Nothing to sign</HandedToYou>}
          question="No source has a candidate waiting." body="A new upstream version that changes a substantive field opens an incident and waits here for a person."
          href="/incidents" cta="Open the incidents" helper="Policy requires a human for substantive changes"
        />
      )}
    </main>
  );
}
