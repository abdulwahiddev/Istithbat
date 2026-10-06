import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/strata/icons';
import { EntityIcon } from '@/components/strata/entity';
import { typeLabel } from '@/components/blast/layout';
import { BrandLockup } from '@/components/strata/BrandLockup';
import { REVISION_NOTE } from '@/components/strata/format';
import { POLICY_DEFINITIONS } from '@/lib/policy/rules';
import { deriveScenario, type Derived } from './derive';
import { EVIDENCE } from './scenario';
import { BlastGraph } from './BlastGraph';
import { LandingMotion } from './LandingMotion';

/**
 * Landing · everything below the (frozen) hero, as one continuous canvas: chapters are separated by
 * full-width rules, spacing and composition, not by enclosing cards. Every scene is server-rendered
 * in its final state; LandingMotion plays each scene's narrative once as it enters view (steps carry
 * `data-t`, effects are `fx-*` classes in sections.css). Scenario facts come from deriveScenario(),
 * i.e. from the product's own engines; provisional 10618 values carry Draft labels.
 */
export function LandingSections() {
  const d = deriveScenario();
  return (
    <>
      <ChangeSection d={d} />
      <ReachSection d={d} />
      <ContainSection d={d} />
      <EvidenceSection />
      <ClosingSection />
      <LandingMotion />
    </>
  );
}

/* ------------------------------------------------------------------ shared */

const LAYER = { src: 'database', det: 'fingerprint-pattern', ai: 'sparkles', pol: 'scale', hum: 'user-check' } as const satisfies Record<string, IconName>;
function Mark({ layer, size = 16 }: { layer: keyof typeof LAYER; size?: number }) {
  return <Icon name={LAYER[layer]} size={size} className={`lm lm-${layer}`} />;
}
const Mono = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>;
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** Full-width chapter rule: number, layer and a quiet aside. */
function Chapter({ n, layer, label, aside }: { n: string; layer: (keyof typeof LAYER)[]; label: string; aside?: ReactNode }) {
  return (
    <div className="ch" aria-hidden="true">
      <div className="ls-wrap ch-in">
        <span className="ch-n">{n}</span>
        <span className="ch-l">{layer.map((l) => <Mark key={l} layer={l} size={14} />)}{label}</span>
        {aside && <span className="ch-r">{aside}</span>}
      </div>
    </div>
  );
}

/** Section head; each title line rises from its own mask. */
function Head({ id, lines, children, t = 0 }: { id: string; lines: string[]; children?: ReactNode; t?: number }) {
  return (
    <header className="ls-head">
      <h2 id={id} className="ls-h2">{lines.map((l, i) => <span key={i} className="ln"><span className="fx-rise" data-t={t + i * 110}>{l}</span></span>)}</h2>
      {children && <p className="ls-lede fx-fade" data-t={t + 260}>{children}</p>}
    </header>
  );
}

/** Marks a value that is provisional while the 10618 scenario is validated. */
function Draft({ d, what = 'Draft' }: { d: Derived; what?: string }) {
  if (d.s.status !== 'draft') return null;
  return <span className="dft"><i aria-hidden="true" />{what}</span>;
}

/* ------------------------------------------------------- 2 · the exact change */

function ChangeSection({ d }: { d: Derived }) {
  const { s, change: c } = d;
  const removedText = c.removed.join(' ');
  let k = 0; // order of the removed words as they illuminate
  return (
    <section id="change" className="ls ls-change" aria-labelledby="h-change">
      <Chapter n="02" layer={['det']} label="Detect" aside={<>Exact change · <Mono>{s.source.connectorId}:{s.source.recordId}</Mono></>} />
      <div className="ls-wrap">
        <div className="c2-top" data-seq>
          <Head id="h-change" lines={['The source changed.', 'Production didn’t.']}>
            Istithbat fingerprints every monitored record. When a field changes it shows the exact change, word for word, while production keeps serving the version a reviewer trusted.
          </Head>
          <dl className="prov">
            <div className="pv fx-fade" data-t={380}>
              <dt><Icon name="database" size={15} />Original · real record</dt>
              <dd><b>{s.source.name} · record <Mono>{s.source.recordId}</Mono></b><span>Published by {s.source.name}. Unmodified.</span>
                <a className="pv-a" href={s.source.href} target="_blank" rel="noreferrer">View the original <Icon name="arrow-up-right" size={14} /></a></dd>
            </div>
            <div className="pv test fx-fade" data-t={520}>
              <dt><Icon name="flask-conical" size={15} />Test mutation · Istithbat</dt>
              <dd><b>Controlled sandbox input</b><span>Applied by Istithbat to test the pipeline. Never published by {s.source.name}, never served.</span></dd>
            </div>
          </dl>
        </div>

        <figure className="ex" data-seq aria-labelledby="ex-cap">
          <span className="ex-glow" data-par="-28" aria-hidden="true" />
          <figcaption id="ex-cap" className="ex-meta fx-fade" data-t={0}>
            <span className="ex-path"><Icon name="file-text" size={15} /><Mono>{s.source.connectorId}:{s.source.recordId}</Mono><span className="sep" aria-hidden="true">/</span><Mono>{c.path}</Mono></span>
            <span className="tag">{c.roleText}</span>
            <span className="tag co">{c.removed.length} words removed</span>
            <Draft d={d} what="Scenario draft · under validation" />
          </figcaption>

          <div className="ex-row">
            <div className="ex-ver fx-fade" data-t={160}><span className="ver tq mono">{s.original.version}</span><span className="vl">Trusted<small>Original value</small></span></div>
            <p className="ex-ar big fx-wipe" data-t={240} lang="ar" dir="rtl">
              {c.pieces.old.map((p, i) => p.kind === 'removed'
                ? <span key={i}><span className="rm fx-glow" data-t={1750 + (k++) * 140}>{p.text.trimEnd()}</span>{p.text.slice(p.text.trimEnd().length)}</span>
                : <span key={i}>{p.text}</span>)}
            </p>
            <div className="ex-prod on fx-fade" data-t={2750}><span className="rule" aria-hidden="true" /><span><b>Served</b> to {s.app.name}</span>
              <span className="sr-only">. Words removed in {s.mutation.version}: <span lang="ar">{removedText}</span></span></div>
          </div>

          <div className="ex-step fx-fade" data-t={980} aria-hidden="true"><span className="ln-v" /><Icon name="flask-conical" size={14} />Istithbat test mutation applied in the sandbox</div>

          <div className="ex-row cand">
            <div className="ex-ver fx-fade" data-t={1080}><span className="ver co mono">{s.mutation.version}</span><span className="vl co">Latest seen<small>Test mutation</small></span></div>
            <p className="ex-ar fx-wipe" data-t={1160} lang="ar" dir="rtl">
              {c.pieces.ops.map((p, i) => p.kind === 'removed'
                ? (c.pieces.ops[i - 1]?.kind === 'removed' ? null : <span key={i} className="gap fx-gap" data-t={1900} role="img" aria-label={`removed: ${removedText}`} style={{ width: `${Math.min(3.4, Math.max(1, removedText.length * 0.16)).toFixed(2)}em` }} />)
                : <span key={i}>{p.text}</span>)}
            </p>
            <div className="ex-prod off fx-fade" data-t={2950}><Icon name="lock" size={14} /><span><b>Not served</b> · held</span></div>
          </div>

          <div className="ex-foot fx-fade" data-t={2250}>
            <span className="ex-hash"><Mark layer="det" size={14} /><span className="k">Field fingerprint</span><Mono>{short(c.oldHash)}</Mono><span className="arr" aria-hidden="true">→</span>
              <span className="mono co" data-t={2300} data-scramble={short(c.newHash)} data-from={short(c.oldHash)}>{short(c.newHash)}</span></span>
            <span className="note">{c.flags.length ? `Flagged ${c.flags.join(', ').toLowerCase()}.` : 'Not whitespace-, Unicode-, harakat- or punctuation-only: substantive by rule.'}</span>
            <span className="note dim">{REVISION_NOTE}</span>
          </div>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------ 3 · regression + blast radius */

function ReachSection({ d }: { d: Derived }) {
  const { s, answers: w, radius: r } = d;
  let u = 0; // order of the differing answer words as they illuminate
  const Words = ({ segs, mark }: { segs: Derived['answers']['old']; mark: 'removed' | 'added' }) => (
    <>{segs.map((x, i) => <span key={i}>{i > 0 && ' '}{x.kind === mark ? <span className={`${mark === 'removed' ? 'u-tq' : 'u-co'} fx-glow`} data-t={1150 + (u++) * 70}>{x.text}</span> : x.text}</span>)}</>
  );
  const terms = ['Same model', 'Same settings', 'Same question'];
  return (
    <section id="reach" className="ls ls-reach" aria-labelledby="h-reach">
      <Chapter n="03" layer={['det']} label="Test and trace" aside="Matched regression · Blast radius" />
      <div className="ls-wrap">
        <div className="c3-top" data-seq>
          <Head id="h-reach" lines={['See what the change', 'can reach.']}>
            Istithbat asks the protected app’s model the same questions twice, changing only the knowledge. Then it follows the record through every downstream asset.
          </Head>
          <p className="eqn">
            {terms.map((t, i) => <span key={t} className="eq fx-fade" data-t={420 + i * 160}><Icon name="check" size={16} stroke={2.2} className="ok" />{t}<span className="op" aria-hidden="true">+</span></span>)}
            <span className="eq diff fx-fade" data-t={940}><i aria-hidden="true" />Different knowledge <Mono>{s.original.version} ≠ {s.mutation.version}</Mono></span>
            <span className="eq res fx-fade" data-t={1260}><span className="op" aria-hidden="true">=</span><b>{s.regression.material} of {s.regression.matched}</b>&nbsp;matched answers changed <Draft d={d} /></span>
          </p>
        </div>

        <div className="qa" data-seq>
          <div className="qa-q fx-fade" data-t={0}>
            <span className="cap">Pinned question · 1 of {s.regression.matched}</span>
            <p>{s.regression.question}</p>
            {s.regression.answers === 'illustrative' && <Draft d={d} what="Illustrative answers · under validation" />}
          </div>
          <div className="qa-ans">
            <div className="qa-col fx-fade" data-t={300}>
              <span className="qa-h"><i className="tq" /><Mono>{s.original.version}</Mono>Trusted knowledge</span>
              <p className="qa-a"><Words segs={w.old} mark="removed" /></p>
            </div>
            <div className="qa-col fx-fade" data-t={650}>
              <span className="qa-h"><i className="co" /><Mono>{s.mutation.version}</Mono>Candidate knowledge</span>
              <p className="qa-a"><Words segs={w.new} mark="added" /></p>
            </div>
          </div>
          <div className="verdict fx-fade" data-t={1700}>
            <span className="v-h"><Mark layer="ai" size={14} />Verdict · advisory <Draft d={d} /></span>
            <span className="v-r"><i className="co" />Material change<span className="v-d">{d.delta}</span></span>
            <p>{s.regression.why}</p>
            <small>Advisory. Not a ruling.</small>
          </div>
        </div>

        <figure className="rad" data-seq aria-labelledby="rad-cap">
          <figcaption id="rad-cap" className="rad-head">
            <div className="rad-tally">
              <span className="cap fx-fade" data-t={0}>Blast radius · {r.down} downstream assets of record <Mono>{s.source.recordId}</Mono></span>
              <div className="rbar" role="img" aria-label={`${r.exp} exposed, ${r.pending} with impact pending validation, ${r.imp} impacted, ${r.stale} stale`} style={{ gridTemplateColumns: `repeat(${r.down},minmax(0,1fr))` }}>
                {Array.from({ length: r.down }, (_, i) => <span key={i} className={`fx-grow ${i < r.imp ? 'imp' : i < r.imp + r.pending ? 'pend' : 'exp'}`} data-t={260 + i * 90} />)}
              </div>
            </div>
            <div className="rad-cnt">
              <span className="cnt fx-fade" data-t={500}><b className="am" data-t={500} data-count={String(r.exp)}>{r.exp}</b><span className="cap">Exposed</span></span>
              {r.verified || r.imp ? <span className="cnt fx-fade" data-t={600}><b className="co">{r.imp}</b><span className="cap">Impacted</span></span>
                : <span className="cnt pend fx-fade" data-t={600}><b>{r.pending}</b><span className="cap">Impact pending <Draft d={d} /></span></span>}
              <span className="cnt fx-fade" data-t={700}><b className="dim">{r.stale}</b><span className="cap">Stale</span></span>
            </div>
          </figcaption>
          <BlastGraph g={r.graph} source={s.source.connectorId} field={s.field.path} trusted={s.original.version} candidate={s.mutation.version} />
          <Lineage d={d} />
          <p className="rad-rule fx-fade" data-t={2600}>
            Exposure comes from the dependency graph. Impact needs proof: a material regression against a protected app.
            {r.pending > 0 && <> {r.pendingNames.join(' and ')} stays exposed, not impacted, until the 10618 regression is validated.</>}
          </p>
        </figure>
      </div>
    </section>
  );
}

/** Narrow screens, and the accessible reading of the graph everywhere: the lineage, branch by branch. */
function Lineage({ d }: { d: Derived }) {
  const { s } = d;
  const node = (id: string) => d.radius.graph.nodes.find((n) => n.id === id)!;
  const leaves = s.assets.filter((a) => a.type === 'APPLICATION');
  const chain = (id: string): Derived['s']['assets'] => { const a = s.assets.find((x) => x.id === id); return a ? [...chain(a.from), a] : []; };
  const shared = chain(leaves[0].id).filter((a) => leaves.every((l) => chain(l.id).some((x) => x.id === a.id)));
  let t = 200;
  const item = (a: Derived['s']['assets'][number]) => {
    const st = node(a.id).state;
    const what = st === 'pending' ? 'Exposed · impact pending validation' : st === 'impacted' ? 'Impacted' : 'Exposed';
    return (
      <li key={a.id} className={`li st-${st}${a.type === 'APPLICATION' ? ' app' : ''} fx-lit`} data-t={(t += 160)}>
        <span className="nd"><EntityIcon type={a.type} size={14} /></span>
        <span className="nl"><b>{a.name}</b><span>{typeLabel(a.type)} · {what}{a.mode === 'MATERIALIZED' ? ' · frozen copy' : ''}{a.protected ? ' · protected' : ''}</span></span>
      </li>
    );
  };
  return (
    <div className="lgm">
      <ol className="lgm-trunk" aria-label="Dependency path from the changed record">
        <li className="li st-changed fx-lit" data-t={200}><span className="nd"><EntityIcon type="RECORD" size={14} /></span><span className="nl"><b className="mono">{s.source.connectorId}:{s.source.recordId}</b><span>{s.field.path} changed</span></span></li>
        {shared.map(item)}
      </ol>
      <div className="lgm-branches">
        {leaves.map((l) => <ol key={l.id} className="lgm-br" aria-label={`Branch to ${l.name}`}>{chain(l.id).filter((a) => !shared.some((x) => x.id === a.id)).map(item)}</ol>)}
      </div>
    </div>
  );
}

/* ----------------------------------------------- 4 · policy, gateway, human */

function ContainSection({ d }: { d: Derived }) {
  const { s, policy: p } = d;
  const L = s.mutation.version, T = s.original.version;
  return (
    <section id="contain" className="ls ls-contain" aria-labelledby="h-contain">
      <Chapter n="04" layer={['pol', 'hum']} label="Contain" aside={<>Trust Gateway · <Mono>{p.code}</Mono></>} />
      <div className="ls-wrap">
        <div data-seq>
          <Head id="h-contain" lines={['Unreviewed knowledge', 'stops here.']}>
            A deterministic policy holds the candidate at the Trust Gateway. The protected app keeps reading the trusted version until a reviewer signs.
          </Head>
        </div>
      </div>

      <figure className="gate" data-seq>
        <span className="gate-glow" data-par="18" aria-hidden="true" />
        <p className="sr-only">{L} is stopped at the Trust Gateway by {p.code}; {T} passes through and is served to {s.app.name}.</p>
        <div className="ls-wrap gate-in" aria-hidden="true">
          <div className="gz"><span className="fx-fade" data-t={0}>Upstream</span><span className="c fx-fade" data-t={0}><span>Trust Gateway</span></span><span className="fx-fade" data-t={0}>Production</span></div>
          <span className="gline fx-shut" data-t={1300} />
          <div className="grow held">
            <span className="up"><span className="ver co mono fx-approach" data-t={350}>{L}</span><span className="lane fx-grow" data-t={250}><span className="stop fx-fade" data-t={1420} /><span className="lbl fx-fade" data-t={1600}>Stopped at the gate</span></span></span>
            <span className="out ghost fx-fade" data-t={1750}><b className="mono">{L}</b><span className="chip"><i className="co" />Not served</span><small>Candidate · bound to no app</small></span>
          </div>
          <div className="gmid"><span className="lockb fx-lock" data-t={1350}><Icon name="lock" size={14} stroke={2} />Locked · <Mono>{p.code}</Mono></span></div>
          <div className="grow pass">
            <span className="up"><span className="ver tq mono fx-fade" data-t={1850}>{T}</span><span className="lane fx-grow" data-t={1900}><span className="pkt" /><span className="pkt" /><span className="pkt" /></span></span>
            <span className="out live fx-fade" data-t={2250}><b>{s.app.name}</b><span className="chip"><i className="tq live" />Serving</span><small>Reads <Mono>{T}</Mono> · uninterrupted</small></span>
          </div>
        </div>
      </figure>

      <div className="ls-wrap">
        <div className="inv" data-seq>
          <p className="sr-only">Latest {L} is not trusted {T}; trusted {T} equals served {T}.</p>
          <span className="tile" aria-hidden="true"><span className="cap fx-fade" data-t={0}>Latest</span><span className="ln"><span className="v co fx-rise" data-t={80}>{L}</span></span><span className="st fx-fade" data-t={700}><i />Held · not served</span></span>
          <span className="ln op-w" aria-hidden="true"><span className="op co fx-rise" data-t={260}>≠</span></span>
          <span className="pair" aria-hidden="true">
            <span className="row">
              <span className="tile"><span className="cap fx-fade" data-t={300}>Trusted</span><span className="ln"><span className="v fx-rise" data-t={380}>{T}</span></span></span>
              <span className="ln op-w"><span className="op fx-rise" data-t={520}>=</span></span>
              <span className="tile"><span className="cap fx-fade" data-t={560}>Served</span><span className="ln"><span className="v fx-rise" data-t={640}>{T}</span></span></span>
            </span>
            <span className="bar fx-grow" data-t={900}><i />Serving production</span>
          </span>
        </div>

        <ol className="chain" data-seq aria-label="Who does what">
          <li className="chain-line fx-grow" data-t={150} aria-hidden="true" />
          <li className="au ai fx-fade" data-t={250}>
            <span className="au-k"><span className="dotm"><Mark layer="ai" size={15} /></span>AI advises <Draft d={d} /></span>
            <b className="pu">{s.advisory.label}</b>
            <p>Suggests {s.advisory.recommendedAction.toLowerCase()}. It can add caution; it cannot remove it.</p>
            <small className="pu">Advisory. Not a ruling.</small>
          </li>
          <li className="au pol fx-fade" data-t={600}>
            <span className="au-k"><span className="dotm"><Mark layer="pol" size={15} /></span>Policy contains</span>
            <b><Mono>{p.code}</Mono> · {p.rule?.name}</b>
            <p>{p.rule?.floor}. The same change gets the same outcome, whatever the AI says:</p>
            <table className="cf">
              <caption className="sr-only">Policy outcome for this change under different AI inputs, computed by the policy engine</caption>
              <tbody>{p.counterfactuals.map((x, i) => <tr key={x.when}><th scope="row">{x.when}{i === 0 && <> <Draft d={d} /></>}</th><td><Mono>{x.code}</Mono> · {x.action.toLowerCase()}</td></tr>)}</tbody>
            </table>
          </li>
          <li className="au hum fx-fade" data-t={950}>
            <span className="au-k"><span className="dotm"><Mark layer="hum" size={15} /></span>A human decides</span>
            <b>Reviewer decides</b>
            <ul className="opts" aria-label="Decisions available to the reviewer">
              <li><Icon name="check" size={14} stroke={2} />Approve</li>
              <li><Icon name="x" size={14} stroke={2} />Reject</li>
              <li><Icon name="lock" size={14} stroke={2} />Keep quarantined</li>
              <li><Icon name="arrow-up" size={14} stroke={2} />Escalate</li>
            </ul>
            <p>Only a signed decision moves <Mono>{L}</Mono>. Approval switches the gateway in one transaction, and every step is appended to the record.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- 5 · evidence */

function EvidenceSection() {
  const E = EVIDENCE;
  const n = (x: number) => x.toLocaleString('en-US');
  const bars = [
    { name: 'HadeethEnc', prod: E.production.hadeethencRecords, full: E.corpus.hadeethArabic, unit: 'unique Arabic records' },
    { name: 'QuranEnc', prod: E.production.quranencAyat, full: E.corpus.ayat, unit: 'ayat' },
  ];
  return (
    <section id="evidence" className="ls ls-evidence" aria-labelledby="h-evidence">
      <Chapter n="05" layer={['src']} label="Evidence" aside="Leave the live system. Inspect the record." />
      <div className="plane" data-par="0">
        <div className="ls-wrap">
          <div data-seq>
            <Head id="h-evidence" lines={['Real sources.', 'Measured scope.']}>
              Both connectors read the official APIs. The full corpora were validated offline; Production monitors a deliberately small set.
            </Head>
          </div>

          <div className="ev" data-seq>
            <div className="ev-live">
              <h3 className="ev-h fx-fade" data-t={0}><span className="dot tq" aria-hidden="true" />In Production · live connectors</h3>
              <dl className="ev-list">
                <div className="fx-fade" data-t={150}><dt><Icon name="plug" size={16} />HadeethEnc connector</dt><dd><b>{E.production.hadeethencRecords}</b> records monitored · Arabic and English · official API</dd></div>
                <div className="fx-fade" data-t={280}><dt><Icon name="plug" size={16} />QuranEnc connector</dt><dd><b>{E.production.quranencAyat}</b> ayat monitored · <Mono>{E.corpus.quranTranslation}</Mono> · official API</dd></div>
              </dl>
            </div>
            <div className="ev-off">
              <h3 className="ev-h fx-fade" data-t={120}><span className="dot ring" aria-hidden="true" />Offline full-corpus validation <span className="ev-tag">Not Production ingestion</span></h3>
              <dl className="ev-nums">
                <div className="fx-fade" data-t={300}><dt>Unique HadeethEnc Arabic records</dt><dd data-t={300} data-count={String(E.corpus.hadeethArabic)}>{n(E.corpus.hadeethArabic)}</dd></div>
                <div className="fx-fade" data-t={420}><dt>English translations</dt><dd data-t={420} data-count={String(E.corpus.hadeethEnglish)}>{n(E.corpus.hadeethEnglish)}</dd></div>
                <div className="fx-fade" data-t={540}><dt>Quran surahs · ayat</dt><dd><span data-t={540} data-count={String(E.corpus.surahs)}>{E.corpus.surahs}</span><span className="sl">/</span><span data-t={540} data-count={String(E.corpus.ayat)}>{n(E.corpus.ayat)}</span></dd></div>
              </dl>
              <p className="ev-fine fx-fade" data-t={700}>{E.corpus.passes} independent passes; every raw, canonical, record and field hash matched. Quran figures are for <Mono>{E.corpus.quranTranslation}</Mono> ({E.corpus.quranPublisher}, v{E.corpus.quranVersion}). The validated artifacts stay unassessed and unserved; the validator has no import flag.</p>
            </div>
          </div>

          <div className="scope" data-seq role="group" aria-label="Production scope compared with the offline-validated corpus">
            {bars.map((b, i) => (
              <div key={b.name} className="sc-row">
                <span className="sc-name fx-fade" data-t={i * 160}>{b.name}</span>
                <span className="sc-bar" aria-hidden="true"><span className="full fx-grow" data-t={100 + i * 160} /><span className="prod fx-fade" data-t={900 + i * 160} style={{ width: `max(3px, ${((b.prod / b.full) * 100).toFixed(3)}%)` }} /></span>
                <span className="sc-txt fx-fade" data-t={1000 + i * 160}><b>{n(b.prod)}</b> in Production <span className="dim">of {n(b.full)} {b.unit} validated offline</span></span>
              </div>
            ))}
          </div>

          <div className="ev-foot">
            <span className="tests"><Icon name="list-checks" size={18} /><span><b>{E.tests.passed} automated tests passing</b> · {E.tests.skipped} {E.tests.skippedNote} skipped · typecheck and Production build</span></span>
            <span className="links">
              <a href={E.evidenceDoc} target="_blank" rel="noreferrer">Technical evidence <Icon name="arrow-up-right" size={14} /></a>
              <a href={E.corpusReport} target="_blank" rel="noreferrer">Corpus report <Icon name="arrow-up-right" size={14} /></a>
            </span>
            <span className="date">Audited {E.auditDate}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- 6 · close */

function ClosingSection() {
  const lines = [
    { l: 'ai', t: 'AI advises.', x: 'Analysis and regression verdicts are advisory. They can add caution; they never lower a policy floor.' },
    { l: 'pol', t: 'Policy governs.', x: `${POLICY_DEFINITIONS.length} deterministic rules set the floor for every change, by field role.` },
    { l: 'hum', t: 'Humans decide.', x: 'Only a signed reviewer decision moves a candidate into production.' },
  ] as const;
  return (
    <section id="start" className="ls ls-close" aria-labelledby="h-close">
      <span className="cl-glow" data-par="-20" aria-hidden="true" />
      <div className="ls-wrap" data-seq>
        <div className="cl-grid">
          <h2 id="h-close" className="cl-h">
            {lines.map(({ l, t }, i) => <span key={l} className="ln"><span className="fx-rise" data-t={i * 160}><Mark layer={l} size={28} />{t}</span></span>)}
          </h2>
          <ul className="cl-ex">
            {lines.map(({ l, x }, i) => <li key={l} className="fx-fade" data-t={300 + i * 160}>{x}</li>)}
          </ul>
        </div>
        <div className="cl-ctas fx-fade" data-t={820}>
          <Link prefetch={false} className="lbtn lbtn-p" href="/overview">Open Istithbat <Icon name="arrow-up-right" size={16} /></Link>
          <Link prefetch={false} className="lbtn lbtn-g" href="/sandbox"><span className="live" aria-hidden="true" />Run live sandbox</Link>
        </div>
      </div>
    </section>
  );
}

/** Product footer: only routes and documents that exist. */
export function LandingFooter() {
  const E = EVIDENCE;
  const ext = (href: string, label: string) => <a href={href} target="_blank" rel="noreferrer">{label}<Icon name="arrow-up-right" size={13} /></a>;
  return (
    <footer className="lf">
      <div className="ls-wrap">
        <div className="lf-grid">
          <div className="lf-brand">
            <span className="lf-lock"><BrandLockup theme="dark" /></span>
            <p>Integrity infrastructure for Islamic knowledge.</p>
            <p className="lf-pr"><span><Mark layer="ai" size={14} />AI advises.</span><span><Mark layer="pol" size={14} />Policy governs.</span><span><Mark layer="hum" size={14} />Humans decide.</span></p>
          </div>
          <nav className="lf-col" aria-label="Product">
            <h2>Product</h2>
            <Link prefetch={false} href="/overview">Overview</Link>
            <Link prefetch={false} href="/incidents">Incidents</Link>
            <Link prefetch={false} href="/sources">Sources</Link>
            <Link prefetch={false} href="/gateway">Gateway</Link>
            <Link prefetch={false} href="/sandbox">Sandbox</Link>
          </nav>
          <nav className="lf-col" aria-label="Project">
            <h2>Project</h2>
            {ext(E.repo, 'GitHub')}
            {ext(`${E.repo}#readme`, 'Documentation')}
            {ext(`${E.repo}#how-it-works`, 'Architecture')}
            {ext(E.evidenceDoc, 'Technical evidence')}
          </nav>
          <nav className="lf-col" aria-label="Sources">
            <h2>Sources</h2>
            {ext('https://hadeethenc.com', 'HadeethEnc')}
            {ext('https://quranenc.com', 'QuranEnc')}
          </nav>
        </div>
        <div className="lf-bottom">
          <p>Sources: HadeethEnc.com, Encyclopedia of Translated Prophetic Hadiths (Islamic Content Service Association) · QuranEnc.com, <Mono>{E.corpus.quranTranslation}</Mono> by {E.corpus.quranPublisher}. Connectors are read-only; test mutations exist only inside the Istithbat sandbox.</p>
          <p>Hashes prove that content changed; they do not determine religious truth, hadith authenticity or a fatwa. An independent open-source project.</p>
        </div>
      </div>
    </footer>
  );
}
