import Link from 'next/link';
import { EmptyState } from '@/components/states/States';

export default function NotFound() {
  return (
    <main className="ist-content">
      <EmptyState title="Not found">
        This source or incident does not exist. <Link href="/sources">Back to sources</Link> · <Link href="/incidents">Incidents</Link>
      </EmptyState>
    </main>
  );
}
