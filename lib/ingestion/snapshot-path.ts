import { randomUUID } from 'node:crypto';

/** Demo reset can reuse a revision number, while Storage evidence is immutable. */
export function snapshotPrefix(sourceId:string,label:string,revision:number,isDemoFixture:boolean) {
  const revisionPath=`snapshots/${sourceId}/${label}/r${revision}`;
  return isDemoFixture ? `${revisionPath}/${randomUUID()}` : revisionPath;
}
