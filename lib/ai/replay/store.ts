import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from '../hash';
import type { AiTask } from '../types';

/**
 * AI_MODE=replay: recorded live responses from rehearsal (D-15).
 *
 * Records live as JSON under lib/ai/replay/records/<task>/<key>.json, where key covers
 * task + prompt id/version + inputHash, so a prompt change never replays a stale answer.
 * A missing record is a failure, never a silent fall-through to live or mock.
 * The UI must show "Replayed response (recorded <recordedAt>)".
 *
 * Deployment note: these files are read with fs at runtime, so the Vercel build must trace
 * them (next.config outputFileTracingIncludes: './lib/ai/replay/records/**'). Codex-owned config.
 */
export interface ReplayRecord {
  task: AiTask;
  promptId: string;
  promptVersion: string;
  inputHash: string;
  provider: string;
  model: string;
  temperature: number | null;
  effort: string | null;
  maxTokens: number;
  recordedAt: string;
  /** The validated output exactly as the live provider returned it. */
  output: unknown;
}

const DEFAULT_ROOT = join(process.cwd(), 'lib', 'ai', 'replay', 'records');

export function replayKey(task: AiTask, promptId: string, promptVersion: string, inputHash: string): string {
  return sha256Hex(`${task}|${promptId}|${promptVersion}|${inputHash}`).slice(0, 32);
}

export function readReplay(
  task: AiTask,
  promptId: string,
  promptVersion: string,
  inputHash: string,
  root: string = DEFAULT_ROOT,
): ReplayRecord | null {
  const file = join(root, task, `${replayKey(task, promptId, promptVersion, inputHash)}.json`);
  if (!existsSync(file)) return null;
  try {
    const rec = JSON.parse(readFileSync(file, 'utf8')) as ReplayRecord;
    return rec.inputHash === inputHash && rec.task === task ? rec : null;
  } catch {
    return null;
  }
}

/** Local rehearsal only (AI_RECORD_REPLAY=1, never on Vercel). Contains no secrets. */
export function writeReplay(rec: ReplayRecord, root: string = DEFAULT_ROOT): void {
  const dir = join(root, rec.task);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${replayKey(rec.task, rec.promptId, rec.promptVersion, rec.inputHash)}.json`);
  writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`, 'utf8');
}
