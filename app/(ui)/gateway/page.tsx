import { redirect } from 'next/navigation';
import { ReadError } from '@/components/strata/primitives';
import { readGatewayInventory } from '../_data/read';

export const dynamic = 'force-dynamic';

/** /gateway resolves to the first protected app's binding. */
export default async function GatewayIndex() {
  const inv = await readGatewayInventory();
  const first = inv.ok ? inv.data.find((i) => i.binding && i.appId) : null;
  if (first?.appId) redirect(`/gateway/${encodeURIComponent(first.appId)}`);
  return (
    <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap">
      {inv.ok ? <div className="plate"><b>No protected app is bound to a source yet.</b><p className="body">The gateway serves only bound, trusted versions.</p></div> : <ReadError {...inv.error} />}
    </div></section></main>
  );
}
