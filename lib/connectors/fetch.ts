import 'server-only';
import { SANDBOX_ID } from './sandbox';

export async function fetchSourceSnapshot(sourceId:string, configuredEndpoint:string, origin:string):Promise<Buffer> {
  if(sourceId!==SANDBOX_ID) throw new Error('SOURCE_FETCH_FAILED');
  const target=new URL(configuredEndpoint,origin);
  const expected=new URL('/api/sandbox/current',process.env.APP_BASE_URL??origin);
  if(target.href!==expected.href) throw new Error('SOURCE_FETCH_FAILED');
  let response:Response;
  try { response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000)}); }
  catch { throw new Error('SOURCE_FETCH_FAILED'); }
  if(!response.ok) throw new Error('SOURCE_FETCH_FAILED');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>2_000_000) throw new Error('SOURCE_FETCH_FAILED');
  return bytes;
}
