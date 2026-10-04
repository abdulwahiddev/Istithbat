import Link from 'next/link';
import { PREVIEW_SCENARIOS, SCENARIO_LABELS, type PreviewScenario } from './sources';

/** Lets reviewers step through the Day 1 states while the live read endpoint is pending. */
export function PreviewSwitcher({ current, basePath }: { current: PreviewScenario; basePath: string }) {
  return (
    <div className="ist-row" style={{ marginBlockStart: 8 }}>
      <span className="ist-meta">Preview state:</span>
      <span className="ist-seg">
        {PREVIEW_SCENARIOS.map((s) => (
          <Link key={s} href={`${basePath}?preview=${s}`} aria-current={s === current ? 'true' : undefined}>
            {SCENARIO_LABELS[s]}
          </Link>
        ))}
      </span>
    </div>
  );
}
