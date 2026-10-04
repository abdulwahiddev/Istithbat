import { PageTopbar } from '@/components/shell/AppShell';
import { IncidentTable } from '@/components/incidents/IncidentViews';
import { EmptyState, ErrorState } from '@/components/states/States';
import { readIncidentRows } from '../_data/read';

export const metadata = { title: 'Incidents · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function IncidentsPage() {
  const result = await readIncidentRows();

  return (
    <>
      <PageTopbar crumbs={[{ label: 'Istithbat', href: '/sources' }, { label: 'Incidents' }]} />
      <main className="ist-content">
        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Understand · Test · Trace · Contain</div>
            <h1 className="ist-h1">Incidents</h1>
            <p className="ist-lede">
              One incident per meaningful source-version transition. Each stays open, and its candidate stays untrusted, until the
              investigation and a human decision are complete.
            </p>
          </div>
        </div>

        {!result.ok ? (
          <ErrorState title="Incidents are unavailable" message={result.error.message} code={result.error.code} />
        ) : result.data.length === 0 ? (
          <EmptyState title="No incidents">
            No source change has needed an investigation. Equivalent or metadata-only changes take the deterministic fast path and open
            no incident.
          </EmptyState>
        ) : (
          <IncidentTable rows={result.data} />
        )}
      </main>
    </>
  );
}
