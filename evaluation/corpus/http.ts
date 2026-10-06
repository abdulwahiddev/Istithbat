/** Deliberately serial: at most one request in flight, one start per second. */
export class CorpusHttp {
  stats = { requests: 0, retries: 0, quotaResponses: 0, bytes: 0 };
  private nextStart = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private fetcher: typeof fetch = fetch, private interval = 1000,
    private sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {}
  get(url: string): Promise<{url: string; status: number; body: Buffer}> {
    const request = this.queue.then(() => this.request(url));
    this.queue = request.catch(() => undefined);
    return request;
  }
  private async request(url: string): Promise<{url: string; status: number; body: Buffer}> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['quranenc.com','hadeethenc.com'].includes(parsed.hostname) || !parsed.pathname.startsWith('/api/v1/')) throw new Error('UNOFFICIAL_URL');
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.sleep(Math.max(0, this.nextStart - Date.now()));
      this.nextStart = Date.now() + this.interval;
      this.stats.requests++;
      let response: Response;
      try { response = await this.fetcher(url, {method:'GET', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(20000), headers:{accept:'application/json','user-agent':'Istithbat-corpus-validator/1.0 (read-only)'}}); }
      catch (error) { if (attempt === 2) throw error; this.stats.retries++; this.nextStart = Date.now() + 2000 * 2 ** attempt; continue; }
      if ([408,429].includes(response.status) || response.status >= 500) {
        if (response.status === 429) this.stats.quotaResponses++;
        await response.body?.cancel();
        if (attempt === 2) throw new Error(`HTTP_${response.status}`);
        const retry = response.headers.get('retry-after');
        const delay = retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 0;
        this.stats.retries++; this.nextStart = Date.now() + Math.max(2000*2**attempt, Number.isFinite(delay) ? delay : 0); continue;
      }
      if (response.status !== 200 || !response.headers.get('content-type')?.includes('json')) throw new Error(`INVALID_RESPONSE_${response.status}`);
      const reader = response.body?.getReader(); if (!reader) throw new Error('EMPTY_RESPONSE');
      const chunks: Uint8Array[] = []; let size=0;
      while (true) { const part=await reader.read(); if(part.done) break; size+=part.value.length; if(size>4_000_000) {await reader.cancel();throw new Error('OVERSIZED_RESPONSE');} chunks.push(part.value); }
      const body=Buffer.concat(chunks); JSON.parse(body.toString('utf8')); this.stats.bytes+=body.length; if(this.stats.bytes>256_000_000) throw new Error('CORPUS_SIZE_LIMIT');
      return {url,status:200,body};
    }
    throw new Error('RETRIES_EXHAUSTED');
  }
}
