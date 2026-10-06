import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/strata/icons';
import { EntityIcon } from '@/components/strata/entity';
import { typeLabel } from '@/components/blast/layout';
import { BrandLockup } from '@/components/strata/BrandLockup';
import { REVISION_NOTE } from '@/components/strata/format';
import { POLICY_DEFINITIONS } from '@/lib/policy/rules';
import quranCounts from '@/evaluation/corpus/quran-counts.json';
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
export function LandingSections({ d = deriveScenario() }: { d?: Derived }) {
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
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

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
          <div className="disc fx-fade" data-t={380}>
            <p className="disc-k"><Icon name="database" size={15} />Real {s.source.name} source record · Istithbat-controlled test mutation</p>
            <p className="disc-v">Original record from {s.source.name}. The candidate mutation was created in the Istithbat sandbox and was not published by {s.source.name}.</p>
            <a className="pv-a" href={s.source.href} target="_blank" rel="noreferrer">View the original record <Icon name="arrow-up-right" size={14} /></a>
          </div>
        </div>

        <figure className="ex" data-seq aria-labelledby="ex-cap">
          <span className="ex-glow" data-par="-28" aria-hidden="true" />
          <figcaption id="ex-cap" className="ex-meta fx-fade" data-t={0}>
            <span className="ex-path"><Icon name="file-text" size={15} /><Mono>{s.source.connectorId}:{s.source.recordId}</Mono><span className="sep" aria-hidden="true">/</span><Mono>{c.path}</Mono></span>
            <span className="tag">{c.roleText}</span>
            <span className="tag co">{c.removed.length} words removed</span>
            <Draft d={d} what="Scenario draft · under validation" />
          </figcaption>

          <div className="ex-grid">
            <span className="xh" aria-hidden="true">Version</span>
            <span className="xh r" aria-hidden="true"><Mono>{c.path}</Mono> · exact value</span>
            <span className="xh p" aria-hidden="true">Production</span>

            <div className="ex-ver fx-fade" data-t={160}><span className="ver tq mono">{s.original.version}</span><span className="vl">Trusted<small>Original value</small></span></div>
            <p className="ex-ar fx-wipe" data-t={240} lang="ar" dir="rtl"><span className="ex-v">
              {c.pieces.old.map((p, i) => p.kind === 'removed'
                ? <span key={i}><span className="rm fx-glow" data-t={1750 + (k++) * 140}>{p.text.trimEnd()}</span>{p.text.slice(p.text.trimEnd().length)}</span>
                : <span key={i}>{p.text}</span>)}
            </span></p>
            <div className="ex-prod on fx-fade" data-t={2750}><span className="rule" aria-hidden="true" /><span><b>Served</b> to {s.app.name}</span>
              <span className="sr-only">. Words removed in {s.mutation.version}: <span lang="ar">{removedText}</span></span></div>

            <span className="ex-lin fx-grow-y" data-t={950} aria-hidden="true" />
            <span className="ex-mut fx-fade" data-t={980} aria-hidden="true"><span className="lbl"><Icon name="flask-conical" size={14} />Test mutation · Istithbat sandbox</span></span>
            <span aria-hidden="true" />

            <div className="ex-ver fx-fade" data-t={1080}><span className="ver co mono">{s.mutation.version}</span><span className="vl co">Latest seen<small>Test mutation</small></span></div>
            <p className="ex-ar cand fx-wipe" data-t={1160} lang="ar" dir="rtl"><span className="ex-v">
              {c.pieces.ops.map((p, i) => p.kind === 'removed'
                ? (c.pieces.ops[i - 1]?.kind === 'removed' ? null : <span key={i} className="gap fx-gap" data-t={1900} role="img" aria-label={`removed: ${removedText}`} style={{ width: `${Math.min(3.4, Math.max(1, removedText.length * 0.16)).toFixed(2)}em` }} />)
                : <span key={i}>{p.text}</span>)}
            </span></p>
            <div className="ex-prod off fx-fade" data-t={2950}><Icon name="lock" size={14} /><span><b>Not served</b> · held</span></div>
          </div>

          <div className="ex-foot fx-fade" data-t={2250}>
            <span className="ex-hash"><Mark layer="det" size={14} /><span className="k">Field fingerprint</span><Mono>{short(c.oldHash)}</Mono><span className="arr" aria-hidden="true">→</span>
              <span className="mono co">{short(c.newHash)}</span></span>
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
            {d.radius.verified
              ? <span className="eq res fx-fade" data-t={1260}><span className="op" aria-hidden="true">=</span><b>{s.regression.material} of {s.regression.matched}</b>&nbsp;matched answers changed</span>
              : <span className="eq res pend fx-fade" data-t={1260}><span className="op" aria-hidden="true">=</span>matched-answer result pending validation <Draft d={d} /></span>}
          </p>
        </div>

        <div className="qa" data-seq>
          <div className="qa-q fx-fade" data-t={0}>
            <span className="cap">{d.radius.verified ? `Pinned question · 1 of ${s.regression.matched}` : 'Pinned question'}</span>
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
            <span className="cap fx-fade" data-t={0}>Blast radius · {r.down} downstream assets of record <Mono>{s.source.recordId}</Mono></span>
            <div className="rad-cnt">
              <span className="cnt fx-fade" data-t={300}>
                <b className="am">{r.exp}</b><span className="cap">Exposed</span>
                {r.pending > 0 && <span className="sub"><i className="dash" aria-hidden="true" />includes {r.pending} protected app awaiting impact validation <Draft d={d} /></span>}
              </span>
              {(r.verified || r.imp > 0) && <span className="cnt fx-fade" data-t={400}><b className="co">{r.imp}</b><span className="cap">Impacted</span></span>}
              <span className="cnt fx-fade" data-t={500}><b className="dim">{r.stale}</b><span className="cap">Stale</span></span>
            </div>
          </figcaption>
          <BlastGraph g={r.graph} source={s.source.connectorId} field={s.field.path} trusted={s.original.version} candidate={s.mutation.version} />
          <Lineage d={d} />
          <p className="rad-rule fx-fade" data-t={2600}>
            Exposure comes from the dependency graph. Impact needs proof: a material regression against a protected app.
            {r.pending > 0 && <> {r.pendingNames.join(' and ')} stays exposed, not impacted, until the {s.source.recordId} regression is validated.</>}
          </p>
          <p className="rad-rule stale fx-fade" data-t={2700}>
            <b>Stale</b> applies only to a frozen copy after a newer version is trusted while that copy still holds the previous one. Nothing has been promoted, so {listOf(s.assets.filter((x) => x.mode === 'MATERIALIZED' && x.type === 'API').map((x) => x.name))}’s frozen copy is exposed, not stale.
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
  return (
    <section id="evidence" className="ls ls-evidence" aria-labelledby="h-evidence">
      <Chapter n="05" layer={['src']} label="Evidence" aside="Leave the live system. Inspect the record." />
      <div className="plane" data-par="0">
        <div className="ls-wrap">
          <div data-seq>
            <Head id="h-evidence" lines={['Real sources.', 'Measured scope.']}>
              Both connectors read the official HadeethEnc and QuranEnc APIs. Thousands of records were validated offline; Production deliberately serves a small, trusted baseline.
            </Head>
          </div>

          <div className="ev" data-seq>
            <h3 className="ev-h fx-fade" data-t={0}><span className="dot tq" aria-hidden="true" />Full-corpus validation · offline</h3>
            <dl className="ev-nums">
              <div className="fx-fade" data-t={150}><dd className="num">{n(E.corpus.hadeethArabic)}</dd><dt>HadeethEnc Arabic records validated</dt>
                <dd className="viz"><Marks count={E.corpus.hadeethArabic} cols={112} kind="rec" t={300} /><span className="vcap">One mark per record</span></dd></div>
              <div className="fx-fade" data-t={260}><dd className="num">{n(E.corpus.hadeethEnglish)}</dd><dt>English translations validated</dt>
                <dd className="viz"><Marks count={E.corpus.hadeethEnglish} cols={61} kind="pair" t={420} /><span className="vcap">One Arabic · English pair per translation</span></dd></div>
              <div className="fx-fade" data-t={370}><dd className="num">{E.corpus.surahs}<span className="sl">/</span>{n(E.corpus.ayat)}</dd><dt>Quran surahs / ayat validated</dt>
                <dd className="viz"><SurahBars t={540} /><span className="vcap">One bar per surah · height = its ayat</span></dd></div>
              <div className="fx-fade" data-t={480}><dd className="num">{E.tests.passed}</dd><dt>Automated tests passing</dt>
                <dd className="viz"><Marks count={E.tests.passed} cols={22} kind="test" t={660} /><span className="vcap">One mark per passing test</span></dd></div>
            </dl>
            <p className="ev-sep fx-fade" data-t={800}>Validated artifacts remain separate from the intentionally small live Production baseline.</p>
            <p className="ev-fine fx-fade" data-t={620}>{E.corpus.passes} independent passes over the official APIs; every raw, canonical, record and field hash matched. Quran figures are for <Mono>{E.corpus.quranTranslation}</Mono> ({E.corpus.quranPublisher}, v{E.corpus.quranVersion}). Tests: {E.tests.skipped} {E.tests.skippedNote} skipped; typecheck and Production build pass. Validated artifacts stay unassessed and unserved.</p>
          </div>

          <div className="baseline" data-seq>
            <h3 className="ev-h fx-fade" data-t={0}><span className="dot ring" aria-hidden="true" />Current live baseline</h3>
            <dl className="live-list fx-fade" data-t={120}>
              <div><dt><Icon name="plug" size={15} />HadeethEnc</dt><dd><b>{E.production.hadeethencRecords}</b> monitored records · Arabic and English</dd></div>
              <div><dt><Icon name="plug" size={15} />QuranEnc</dt><dd><b>{E.production.quranencAyat}</b> monitored ayat · <Mono>{E.corpus.quranTranslation}</Mono></dd></div>
            </dl>
            <p className="live-note fx-fade" data-t={240}>Production intentionally uses a small trusted baseline. Full-corpus coverage was validated offline before live ingestion is expanded.</p>
          </div>

          <div className="ev-foot">
            <span className="links">
              <a href={E.evidenceDoc} target="_blank" rel="noreferrer">Technical evidence <Icon name="arrow-up-right" size={14} /></a>
              <a href={E.corpusReport} target="_blank" rel="noreferrer">Corpus validation report <Icon name="arrow-up-right" size={14} /></a>
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

/**
 * Literal corpus marks: exactly `count` marks, in rows of `cols` (the last row holds the remainder).
 * Drawn as tiled CSS backgrounds whose boxes are exact multiples of the mark, so the count is exact
 * without thousands of DOM nodes. The marks reveal by mask; the number beside them never changes.
 */
function Marks({ count, cols, kind, t }: { count: number; cols: number; kind: 'rec' | 'pair' | 'test'; t: number }) {
  const rows = Math.floor(count / cols), rem = count % cols;
  return (
    <span className={`marks k-${kind} fx-reveal`} data-t={t} data-marks={count} aria-hidden="true">
      {rows > 0 && <span className="mr" style={{ ['--c' as string]: cols, ['--r' as string]: rows }} />}
      {rem > 0 && <span className="mr" style={{ ['--c' as string]: rem, ['--r' as string]: 1 }} />}
    </span>
  );
}

/** The validated Quran translation as its real structure: 114 surahs, bar height = ayat (quran-counts.json). */
function SurahBars({ t }: { t: number }) {
  const counts = Object.values(quranCounts as Record<string, number>);
  const max = Math.max(...counts), W = 2.4, H = 64;
  return (
    <svg className="surahs fx-reveal" data-t={t} data-marks={counts.length} viewBox={`0 0 ${counts.length * W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {counts.map((c, i) => { const h = Math.max(1, (c / max) * (H - 2)); return <rect key={i} x={i * W} y={H - h} width={1.6} height={h} rx={0.5} />; })}
    </svg>
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
          </div>
          <nav className="lf-col" aria-label="Product">
            <h2>Product</h2>
            <Link prefetch={false} href="/overview">Overview</Link>
            <Link prefetch={false} href="/incidents">Incidents</Link>
            <Link prefetch={false} href="/gateway">Gateway</Link>
            <Link prefetch={false} href="/sandbox">Sandbox</Link>
          </nav>
          <nav className="lf-col" aria-label="Project">
            <h2>Project</h2>
            {ext(E.repo, 'GitHub')}
            {ext(`${E.repo}#readme`, 'Documentation')}
            {ext(E.evidenceDoc, 'Technical evidence')}
            {ext(E.corpusReport, 'Corpus validation report')}
          </nav>
        </div>
        <div className="lf-bottom">
          <p>Sources: HadeethEnc · QuranEnc. HadeethEnc.com, Encyclopedia of Translated Prophetic Hadiths (Islamic Content Service Association); QuranEnc.com, <Mono>{E.corpus.quranTranslation}</Mono> by {E.corpus.quranPublisher}. Connectors are read-only; test mutations exist only inside the Istithbat sandbox.</p>
          <p>Hashes prove that content changed; they do not determine religious truth, hadith authenticity or a fatwa. An independent open-source project.</p>
        </div>
      </div>
    </footer>
  );
}
