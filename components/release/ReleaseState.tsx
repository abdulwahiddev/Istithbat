export interface ReleaseVersionRef {
  label: string;
  revision?: number | null;
}

function Ref({ v }: { v: ReleaseVersionRef | null }) {
  if (!v) return <span className="ist-diff__empty">none</span>;
  return (
    <>
      {v.label}
      {v.revision ? <small>r{v.revision}</small> : null}
    </>
  );
}

function same(a: ReleaseVersionRef | null, b: ReleaseVersionRef | null) {
  return !!a && !!b && a.label === b.label && (a.revision ?? 1) === (b.revision ?? 1);
}

/**
 * Latest seen, latest trusted and currently served are three different facts (Bible App. A).
 * They are always shown side by side, and the sentence below states the containment in words.
 */
export function ReleaseState({ seen, trusted, served }: { seen: ReleaseVersionRef | null; trusted: ReleaseVersionRef | null; served: ReleaseVersionRef | null }) {
  const seenUntrusted = !!seen && !same(seen, trusted);
  const sentence = !served
    ? 'Nothing is served: no version of this source has been trusted yet.'
    : seenUntrusted
      ? `Protected apps are served ${served.label}${served.revision && served.revision > 1 ? ` r${served.revision}` : ''}. The latest upstream version, ${seen!.label}${seen!.revision && seen!.revision > 1 ? ` r${seen!.revision}` : ''}, has been seen but is not trusted and is not served.`
      : `Protected apps are served ${served.label}, which is also the latest version seen upstream.`;

  return (
    <div className="ist-release" role="group" aria-label="Release state">
      <div className={`ist-release__cell${seenUntrusted ? ' ist-release__cell--untrusted' : ''}`}>
        <span className="ist-release__label">Latest seen upstream</span>
        <span className="ist-release__value">
          <Ref v={seen} />
        </span>
        <span className="ist-meta">{seenUntrusted ? 'Untrusted candidate' : 'Matches trusted'}</span>
      </div>
      <div className="ist-release__cell">
        <span className="ist-release__label">Latest trusted</span>
        <span className="ist-release__value">
          <Ref v={trusted} />
        </span>
        <span className="ist-meta">Promoted by policy ALLOW or human approval only</span>
      </div>
      <div className="ist-release__cell ist-release__cell--served">
        <span className="ist-release__label">Currently served (Trust Gateway)</span>
        <span className="ist-release__value">
          <Ref v={served} />
        </span>
        <span className="ist-meta">What protected apps resolve</span>
      </div>
      <p className="ist-release__sentence" style={{ margin: 0 }}>
        {sentence}
      </p>
    </div>
  );
}
