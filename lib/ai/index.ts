import 'server-only';

/**
 * lib/ai — the provider-neutral AI layer (D-15). Owner: Claude.
 *
 *   const r = await generateStructured({
 *     task: 'INCIDENT_ANALYSIS',
 *     schema: IncidentAnalysisSchema,
 *     input: contextPacket,
 *   });
 *   if (!r.ok) { record r.errorCode; keep the deterministic diff; policy fails closed }
 *   persist r.meta in every case.
 *
 * AI output is advisory: it may raise a policy action, never lower it, and never makes
 * content TRUSTED. Server-only — the API key never reaches the client.
 */
export { generateStructured } from './generate';
export type { GenerateDeps } from './generate';
export * from './types';
export * from './schemas';
export { TASK_SPECS } from './tasks';
export { listPrompts } from './prompts';
export { hashInput } from './hash';
