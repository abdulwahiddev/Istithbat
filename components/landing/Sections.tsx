import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/strata/icons';
import { EntityIcon } from '@/components/strata/entity';
import { typeLabel } from '@/components/blast/layout';
import { BrandLockup } from '@/components/strata/BrandLockup';
import { REVISION_NOTE } from '@/components/strata/format';
import { deriveScenario, type Derived } from './derive';
import { EVIDENCE } from './scenario';
import { RevealObserver } from './RevealObserver';

/**
 * Landing · everything below the (frozen) hero. Server-rendered in its final state; motion is a
 * one-shot enhancement added by RevealObserver when a section enters view, skipped under reduced
 * motion. Scenario facts come from deriveScenario(), i.e. from the product's own engines.
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
      <RevealObserver />
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

function Head({ id, layer, eyebrow, title, children }: { id: string; layer: (keyof typeof LAYER)[]; eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="ls-head rv">
      <p className="ls-eyebrow">{layer.map((l) => <Mark key={l} layer={l} />)}{eyebrow}</p>
      <h2 id={id} className="ls-h2">{title}</h2>
      {children && <p className="ls-lede">{children}</p>}
    </header>
  );
}

/** Marks scenario values while the 10618 scenario is still being validated. */
function DraftTag({ d, what = 'Scenario draft' }: { d: Derived; what?: string }) {
  if (d.s.status !== 'draft') return null;
  return <span className="ls-draft"><i aria-hidden="true" />{what} · under validation</span>;
}

/* ------------------------------------------------------- 2 · the exact change */

function ChangeSection({ d }: { d: Derived }) {
  const { s, change: c } = d;
  const old = c.pieces.old, ops = c.pieces.ops;
  const removedText = c.removed.join(' ');
  return (
    <section id="change" className="ls ls-change" aria-labelledby="h-change">
      <div className="ls-wrap">
        <div className="ls-top">
          <Head id="h-change" layer={['det']} eyebrow="Detect · deterministic" title={<>The source changed.<br />Production didn’t.</>}>
            Istithbat fingerprints every monitored record. When a field changes, it shows the exact change, word for word, while production keeps serving the version a reviewer trusted.
          </Head>

          <ol className="ls-prov rv" aria-label="Where each value comes from">
            <li className="pv pv-real">
              <span className="pv-k"><Icon name="database" size={16} />Original · real record</span>
              <b>{s.source.name} · record <Mono>{s.source.recordId}</Mono></b>
              <span className="pv-v">Published by {s.source.name}. Unmodified.</span>
              <a className="pv-a" href={s.source.href} target="_blank" rel="noreferrer">View the original <Icon name="arrow-up-right" size={14} /></a>
            </li>
            <li className="pv-arrow" aria-hidden="true"><Icon name="arrow-right" size={16} /></li>
            <li className="pv pv-test">
              <span className="pv-k"><Icon name="flask-conical" size={16} />Test mutation · Istithbat</span>
              <b>Controlled sandbox input</b>
              <span className="pv-v">Applied by Istithbat to test the pipeline. Never published by {s.source.name}, never served.</span>
            </li>
          </ol>
        </div>

        <figure className="xc rv" aria-labelledby="xc-cap">
          <figcaption id="xc-cap" className="xc-bar">
            <span className="xc-field"><Icon name="file-text" size={16} /><Mono>{s.source.connectorId}:{s.source.recordId}</Mono><span className="sep" aria-hidden="true">/</span><Mono>{c.path}</Mono></span>
            <span className="chip">{c.roleText}</span>
            <span className="chip"><i className="co" />{c.removed.length} words removed</span>
            <span className="xc-bar-r"><DraftTag d={d} /></span>
          </figcaption>

          <div className="xc-grid">
            <span className="xc-colh" aria-hidden="true">Version</span>
            <span className="xc-colh xc-colh-v" aria-hidden="true">{s.field.label} · exact value</span>
            <span className="xc-colh xc-colh-p" aria-hidden="true">Production</span>

            <div className="xc-ver"><span className="ver tq mono">{s.original.version}</span><span className="xc-vl">Trusted<small>Original value</small></span></div>
            <p className="xc-text" lang="ar" dir="rtl">
              {old.map((p, i) => p.kind === 'removed'
                ? <span key={i}><span className="rm">{p.text.trimEnd()}</span>{p.text.slice(p.text.trimEnd().length)}</span>
                : <span key={i}>{p.text}</span>)}
            </p>
            <div className="xc-serve on"><span className="rule" aria-hidden="true" /><span><b>Served</b> to {s.app.name}</span><span className="sr-only">. Words removed in {s.mutation.version}: <span lang="ar">{removedText}</span></span></div>

            <div className="xc-ver"><span className="ver co mono">{s.mutation.version}</span><span className="xc-vl co">Latest seen<small>Test mutation</small></span></div>
            <p className="xc-text" lang="ar" dir="rtl">
              {ops.map((p, i) => p.kind === 'removed'
                ? (ops[i - 1]?.kind === 'removed' ? null : <span key={i} className="gap" role="img" aria-label={`removed: ${removedText}`} style={{ width: `${Math.min(3.4, Math.max(1, removedText.length * 0.16)).toFixed(2)}em` }} />)
                : <span key={i}>{p.text}</span>)}
            </p>
            <div className="xc-serve off"><Icon name="lock" size={14} /><span><b>Not served</b> · held</span></div>
          </div>

          <div className="xc-foot">
            <span className="xc-hash"><Mark layer="det" size={14} /><span className="k">Field fingerprint</span><Mono>{short(c.oldHash)}</Mono><span className="arr" aria-hidden="true">→</span><Mono>{short(c.newHash)}</Mono></span>
            <span className="xc-note">{c.flags.length ? `Flagged ${c.flags.join(', ').toLowerCase()}.` : 'Not whitespace-, Unicode-, harakat- or punctuation-only, so it is substantive by rule.'}</span>
            <span className="xc-note dim">{REVISION_NOTE}</span>
          </div>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------ 3 · regression + blast radius */

function ReachSection({ d }: { d: Derived }) {
  const { s, answers: w, radius: r } = d;
  const illustrative = s.regression.answers === 'illustrative';
  const terms: { k: string; v: ReactNode; same: boolean }[] = [
    { k: 'Model', v: 'Identical', same: true },
    { k: 'Settings', v: 'Temperature, tokens, prompt', same: true },
    { k: 'Question', v: 'Pinned for this record', same: true },
    { k: 'Knowledge', v: <><Mono>{s.original.version}</Mono> ≠ <Mono>{s.mutation.version}</Mono></>, same: false },
  ];
  return (
    <section id="reach" className="ls ls-reach" aria-labelledby="h-reach">
      <div className="ls-wrap">
        <Head id="h-reach" layer={['det']} eyebrow="Test · matched regression  ·  Trace · blast radius" title="See what the change can reach.">
          Istithbat asks the protected app’s model the same questions twice, changing only the knowledge. Then it follows the record through every downstream asset.
        </Head>

        <div className="eq rv">
          <p className="sr-only">Same model, same settings, same question, different knowledge ({s.original.version} versus {s.mutation.version}). Result: {s.regression.material} of {s.regression.matched} matched answers changed.</p>
          {terms.map((t, i) => (
            <span key={t.k} className="eq-cell" aria-hidden="true">
              {i > 0 && <span className="eq-op">+</span>}
              <span className={`eq-t${t.same ? '' : ' diff'}`}>
                <span className="eq-k">{t.same ? <Icon name="check" size={14} stroke={2.2} /> : <i />}{t.same ? `Same ${t.k.toLowerCase()}` : `Different ${t.k.toLowerCase()}`}</span>
                <span className="eq-v">{t.v}</span>
              </span>
            </span>
          ))}
          <span className="eq-cell" aria-hidden="true">
            <span className="eq-op">=</span>
            <span className="eq-t res"><span className="eq-k"><Mark layer="det" size={14} />Matched regression</span><span className="eq-v"><b>{s.regression.material} of {s.regression.matched}</b> answers changed</span></span>
          </span>
        </div>

        <div className="rg rv">
          <div className="rg-q">
            <span className="cap">Pinned question · 1 of {s.regression.matched}</span>
            <p>{s.regression.question}</p>
            {illustrative && <DraftTag d={d} what="Illustrative answers" />}
          </div>
          <div className="rg-ans">
            <div className="rg-col">
              <span className="rg-h"><i className="tq" /><Mono>{s.original.version}</Mono><span>Trusted knowledge</span></span>
              <p className="rg-a"><Words segs={w.old} mark="removed" /></p>
            </div>
            <div className="rg-col">
              <span className="rg-h"><i className="co" /><Mono>{s.mutation.version}</Mono><span>Candidate knowledge</span></span>
              <p className="rg-a"><Words segs={w.new} mark="added" /></p>
            </div>
          </div>
          <div className="rg-foot">
            <div className="verdict">
              <span className="v-h"><Mark layer="ai" size={14} />Verdict · advisory</span>
              <span className="v-r"><i className="co" />Material change<span className="v-d">{d.delta}</span></span>
              <p>{s.regression.why}</p>
              <small>Advisory. Not a ruling.</small>
            </div>
          </div>
        </div>

        <figure className="br rv" aria-labelledby="br-cap">
          <figcaption id="br-cap" className="br-head">
            <div className="br-tally">
              <div className="radius" role="img" aria-label={`Blast radius: ${r.imp} impacted, ${r.exp} exposed, ${r.stale} stale of ${r.down} downstream assets`} style={{ gridTemplateColumns: `repeat(${r.down},minmax(0,1fr))` }}>
                {Array.from({ length: r.down }, (_, i) => <span key={i} className={i < r.imp ? 'imp' : 'exp'} />)}
              </div>
              <span className="cap">Blast radius · {r.down} downstream assets of record <Mono>{s.source.recordId}</Mono></span>
            </div>
            <div className="br-cnt">
              <span className="cnt"><b className="co">{r.imp}</b><span className="cap">Impacted</span></span>
              <span className="cnt"><b className="am">{r.exp}</b><span className="cap">Exposed</span></span>
              <span className="cnt"><b className="dim">{r.stale}</b><span className="cap">Stale</span></span>
            </div>
          </figcaption>
          <Graph d={d} />
          <Lineage d={d} />
          <p className="br-rule">Exposure comes from the dependency graph. Impact needs proof: a material regression against a protected app. Stale applies only to frozen copies, and only after a promotion.</p>
        </figure>
      </div>
    </section>
  );
}

function Words({ segs, mark }: { segs: Derived['answers']['old']; mark: 'removed' | 'added' }) {
  return <>{segs.map((x, i) => <span key={i}>{i > 0 && ' '}{x.kind === mark ? <span className={mark === 'removed' ? 'u-tq' : 'u-co'}>{x.text}</span> : x.text}</span>)}</>;
}

/** Desktop graph: the product's dependency layout (components/blast/layout) over the scenario graph. */
function Graph({ d }: { d: Derived }) {
  const { lay } = d.radius;
  const state = (n: (typeof lay.nodes)[number]) => n.assetType === 'SOURCE' ? 'neutral' : n.assetType === 'RECORD' ? 'changed' : n.impact === 'IMPACTED' ? 'impacted' : 'exposed';
  const sub = (n: (typeof lay.nodes)[number]) => n.assetType === 'SOURCE' ? `${d.s.mutation.version} seen · ${d.s.original.version} trusted`
    : n.assetType === 'RECORD' ? `${d.s.field.path} changed`
    : n.app ? `${n.impact === 'IMPACTED' ? 'Impacted' : 'Exposed'} · ${n.protectedApp ? `reads ${d.s.original.version}` : 'not protected'}`
    : `${typeLabel(n.assetType)} · ${n.derivationMode === 'MATERIALIZED' ? 'frozen copy' : 'Exposed'}`;
  return (
    <div className="lg" aria-hidden="true">
      <div className="lg-in" style={{ height: lay.height }}>
        {lay.headings.map((h) => <span key={h.depth} className="colh" style={{ left: `${h.x}%` }}>{h.label}</span>)}
        <svg className="edges" viewBox={`0 0 100 ${lay.height}`} preserveAspectRatio="none">
          {lay.edges.map((e) => {
            const from = lay.nodes.find((n) => n.id === e.from)!;
            return <path key={e.id} className={`e-${e.kind}`} d={e.d} pathLength={1} style={{ ['--d' as string]: from.depth }} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {[...lay.nodes].sort((a, b) => a.depth - b.depth || a.y - b.y).map((n) => {
          const st = state(n), card = n.app;
          const style: CSSProperties = { ...(card ? { left: `${n.x}%`, right: 0, top: n.y - 28 } : { left: `${n.x}%`, top: n.y - 14 }), ['--d' as string]: n.depth };
          return (
            <div key={n.id} className={`node st-${st}${card ? ' card' : ''}`} style={style}>
              <span className="nd"><EntityIcon type={n.assetType} size={card ? 16 : 15} /></span>
              <span className="nl"><b className={n.assetType === 'RECORD' ? 'mono' : ''}>{n.assetType === 'RECORD' ? `${d.s.source.connectorId}:${n.name}` : n.name}</b><span>{sub(n)}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Narrow screens: the same graph as a lineage list, branch by branch. */
function Lineage({ d }: { d: Derived }) {
  const { s } = d;
  const leaves = s.assets.filter((a) => a.type === 'APPLICATION');
  const chain = (id: string): Derived['s']['assets'] => { const a = s.assets.find((x) => x.id === id); return a ? [...chain(a.from), a] : []; };
  const shared = chain(leaves[0].id).filter((a) => leaves.every((l) => chain(l.id).some((x) => x.id === a.id)));
  const item = (a: Derived['s']['assets'][number]) => {
    const imp = !!a.protected && s.regression.material > 0;
    return (
      <li key={a.id} className={`li st-${imp ? 'impacted' : 'exposed'}${a.type === 'APPLICATION' ? ' app' : ''}`}>
        <span className="nd"><EntityIcon type={a.type} size={14} /></span>
        <span className="nl"><b>{a.name}</b><span>{typeLabel(a.type)} · {imp ? 'Impacted' : 'Exposed'}{a.mode === 'MATERIALIZED' ? ' · frozen copy' : ''}{a.protected ? ' · protected' : ''}</span></span>
      </li>
    );
  };
  return (
    <div className="lgm">
      <ol className="lgm-trunk" aria-label="Dependency path from the changed record">
        <li className="li st-changed"><span className="nd"><EntityIcon type="RECORD" size={14} /></span><span className="nl"><b className="mono">{s.source.connectorId}:{s.source.recordId}</b><span>{s.field.path} changed</span></span></li>
        {shared.map(item)}
      </ol>
      <div className="lgm-branches">
        {leaves.map((l) => (
          <ol key={l.id} className="lgm-br" aria-label={`Branch to ${l.name}`}>{chain(l.id).filter((a) => !shared.some((x) => x.id === a.id)).map(item)}</ol>
        ))}
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
      <div className="ls-wrap">
        <Head id="h-contain" layer={['pol', 'hum']} eyebrow="Contain · policy and human review" title="Unreviewed knowledge stops here.">
          A deterministic policy holds the candidate at the Trust Gateway. The protected app keeps reading the trusted version until a reviewer signs.
        </Head>

        <figure className="gw rv">
          <div className="gw-d" aria-hidden="true">
            <div className="gw-z"><span>Upstream</span><span className="c">Trust Gateway</span><span>Production</span></div>
            <span className="gw-bar" />
            <div className="gw-row held">
              <span className="up"><span className="ver co mono">{L}</span><span className="lane"><span className="lbl">Stopped at the gate</span></span></span>
              <span className="out"><b className="mono">{L}</b><span className="chip"><i className="co" />Not served</span><small>Candidate · bound to no app</small></span>
            </div>
            <div className="gw-mid"><span className="lockb"><Icon name="lock" size={14} stroke={2} />Locked · <Mono>{p.code}</Mono></span></div>
            <div className="gw-row pass">
              <span className="up"><span className="ver tq mono">{T}</span><span className="lane"><span className="pkt" /><span className="pkt" /><span className="pkt" /></span></span>
              <span className="out live"><b>{s.app.name}</b><span className="chip"><i className="tq" />Serving</span><small>Reads <Mono>{T}</Mono> · uninterrupted</small></span>
            </div>
          </div>
          <figcaption className="inv">
            <span className="sr-only">{L} is stopped at the Trust Gateway by {p.code}; {T} passes through and is served to {s.app.name}. Latest {L} is not trusted {T}; trusted {T} equals served {T}.</span>
            <span className="tile" aria-hidden="true"><span className="cap">Latest</span><span className="v co">{L}</span><span className="st co"><i />Held · not served</span></span>
            <span className="op co" aria-hidden="true">≠</span>
            <span className="pair" aria-hidden="true">
              <span className="row">
                <span className="tile"><span className="cap">Trusted</span><span className="v">{T}</span></span>
                <span className="op">=</span>
                <span className="tile"><span className="cap">Served</span><span className="v">{T}</span></span>
              </span>
              <span className="bar"><i />Serving production</span>
            </span>
          </figcaption>
        </figure>

        <ol className="auth rv" aria-label="Who does what">
          <li className="au au-ai">
            <span className="au-k"><Mark layer="ai" />AI advises</span>
            <b className="pu">{s.advisory.label}</b>
            <p>Suggests {s.advisory.recommendedAction.toLowerCase()}. It can add caution; it cannot remove it.</p>
            <small className="pu">Advisory. Not a ruling.</small>
          </li>
          <li className="au au-pol">
            <span className="au-k"><Mark layer="pol" />Policy contains</span>
            <b><Mono>{p.code}</Mono> · {p.rule?.name}</b>
            <p>{p.rule?.floor}. Deterministic: the same change gets the same outcome, whatever the AI says.</p>
            <table className="cf">
              <caption className="sr-only">Policy outcome for this change under different AI inputs, computed by the policy engine</caption>
              <tbody>{p.counterfactuals.map((x) => <tr key={x.when}><th scope="row">{x.when}</th><td><Mono>{x.code}</Mono> · {x.action.toLowerCase()}</td></tr>)}</tbody>
            </table>
          </li>
          <li className="au au-hum">
            <span className="au-k"><Mark layer="hum" />A human decides</span>
            <b>Reviewer decides</b>
            <ul className="opts" aria-label="Decisions available to the reviewer">
              <li><Icon name="check" size={14} stroke={2} />Approve</li>
              <li><Icon name="x" size={14} stroke={2} />Reject</li>
              <li><Icon name="lock" size={14} stroke={2} />Keep quarantined</li>
              <li><Icon name="arrow-up" size={14} stroke={2} />Escalate</li>
            </ul>
            <p>Only a signed decision moves <Mono>{L}</Mono>. Approval switches the gateway in one transaction; everything is appended to the record.</p>
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
    { name: 'HadeethEnc', prod: E.production.hadeethencRecords, prodUnit: 'records', full: E.corpus.hadeethArabic, fullUnit: 'unique Arabic records' },
    { name: 'QuranEnc', prod: E.production.quranencAyat, prodUnit: 'ayat', full: E.corpus.ayat, fullUnit: 'ayat' },
  ];
  return (
    <section id="evidence" className="ls ls-evidence" aria-labelledby="h-evidence">
      <div className="ls-wrap">
        <Head id="h-evidence" layer={['src']} eyebrow="Evidence" title="Real sources. Measured scope.">
          Both connectors read the official APIs. The full corpora were validated offline; Production monitors a deliberately small set.
        </Head>

        <div className="ev-grid rv">
          <div className="ev-col">
            <h3 className="ev-h"><span className="dot tq" aria-hidden="true" />In Production · live connectors</h3>
            <dl className="ev-list">
              <div><dt><Icon name="plug" size={16} />HadeethEnc connector</dt><dd><b>{E.production.hadeethencRecords}</b> records monitored · Arabic and English · official API</dd></div>
              <div><dt><Icon name="plug" size={16} />QuranEnc connector</dt><dd><b>{E.production.quranencAyat}</b> ayat monitored · <Mono>{E.corpus.quranTranslation}</Mono> · official API</dd></div>
            </dl>
          </div>
          <div className="ev-col off">
            <h3 className="ev-h"><span className="dot ring" aria-hidden="true" />Offline full-corpus validation <span className="ev-tag">Not Production ingestion</span></h3>
            <dl className="ev-nums">
              <div><dt>Unique HadeethEnc Arabic records</dt><dd>{n(E.corpus.hadeethArabic)}</dd></div>
              <div><dt>English translations</dt><dd>{n(E.corpus.hadeethEnglish)}</dd></div>
              <div><dt>Quran surahs · ayat</dt><dd>{E.corpus.surahs}<span className="sl">/</span>{n(E.corpus.ayat)}</dd></div>
            </dl>
            <p className="ev-fine">{E.corpus.passes} independent passes; every raw, canonical, record and field hash matched. Quran figures are for <Mono>{E.corpus.quranTranslation}</Mono> ({E.corpus.quranPublisher}, v{E.corpus.quranVersion}). The validated artifacts stay unassessed and unserved; the validator has no import flag.</p>
          </div>
        </div>

        <div className="scope rv" role="group" aria-label="Production scope compared with the offline-validated corpus">
          {bars.map((b) => (
            <div key={b.name} className="sc-row">
              <span className="sc-name">{b.name}</span>
              <span className="sc-bar" aria-hidden="true"><span className="full" /><span className="prod" style={{ width: `max(3px, ${((b.prod / b.full) * 100).toFixed(3)}%)` }} /></span>
              <span className="sc-txt"><b>{n(b.prod)}</b> in Production <span className="dim">of {n(b.full)} {b.fullUnit} validated offline</span></span>
            </div>
          ))}
        </div>

        <div className="ev-foot rv">
          <span className="tests"><Icon name="list-checks" size={18} /><span><b>{E.tests.passed} automated tests passing</b> · {E.tests.skipped} {E.tests.skippedNote} skipped · typecheck and Production build</span></span>
          <span className="links">
            <a href={E.evidenceDoc} target="_blank" rel="noreferrer">Technical evidence <Icon name="arrow-up-right" size={14} /></a>
            <a href={E.corpusReport} target="_blank" rel="noreferrer">Corpus report <Icon name="arrow-up-right" size={14} /></a>
          </span>
          <span className="date">Audited {E.auditDate}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- 6 · close */

function ClosingSection() {
  return (
    <section id="start" className="ls ls-close" aria-labelledby="h-close">
      <div className="ls-wrap">
        <h2 id="h-close" className="cl-h rv">
          <span><Mark layer="ai" size={28} />AI advises.</span>
          <span><Mark layer="pol" size={28} />Policy governs.</span>
          <span><Mark layer="hum" size={28} />Humans decide.</span>
        </h2>
        <div className="cl-ctas rv">
          <Link prefetch={false} className="lbtn lbtn-p" href="/overview">Open Istithbat <Icon name="arrow-up-right" size={16} /></Link>
          <Link prefetch={false} className="lbtn lbtn-g" href="/sandbox"><span className="live" aria-hidden="true" />Run live sandbox</Link>
        </div>
        <footer className="cl-foot">
          <span className="cl-brand"><BrandLockup theme="dark" /></span>
          <p className="cl-attr">Sources: HadeethEnc.com, Encyclopedia of Translated Prophetic Hadiths (Islamic Content Service Association) · QuranEnc.com, <Mono>{EVIDENCE.corpus.quranTranslation}</Mono> by {EVIDENCE.corpus.quranPublisher}. Connectors are read-only; test mutations exist only inside the Istithbat sandbox.</p>
          <nav className="cl-links" aria-label="Project">
            <a href={EVIDENCE.repo} target="_blank" rel="noreferrer">GitHub <Icon name="arrow-up-right" size={14} /></a>
            <a href={EVIDENCE.evidenceDoc} target="_blank" rel="noreferrer">Docs <Icon name="arrow-up-right" size={14} /></a>
          </nav>
        </footer>
      </div>
    </section>
  );
}
