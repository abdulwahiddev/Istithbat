import { SourcesPage } from '../screen';

export const metadata = { title: 'Sources · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return <SourcesPage selectedId={decodeURIComponent(sourceId)} />;
}
