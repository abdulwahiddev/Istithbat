import { z } from 'zod';
import { IncidentAnalysisSchema, type IncidentAnalysis } from '@/lib/ai/schemas';

/**
 * The contract types `contextPacket` and `analysis.output` as unknown. These readers accept
 * only the fields the UI displays and never throw: an unexpected shape degrades to "not shown",
 * with the raw JSON still available, rather than a guessed rendering.
 */

const ContextRecord = z.object({
  canonical_key: z.string(),
  old_content: z.record(z.string(), z.unknown()).nullable().optional(),
  new_content: z.record(z.string(), z.unknown()).nullable().optional(),
});
const ContextPacketView = z.object({
  trusted: z.object({ id: z.string(), label: z.string(), revision: z.number() }).nullable().optional(),
  previous: z.object({ id: z.string(), label: z.string(), revision: z.number() }).nullable().optional(),
  candidate: z.object({ id: z.string(), label: z.string(), revision: z.number() }).nullable().optional(),
  records: z.array(ContextRecord).optional(),
  elements: z.array(z.object({ kind: z.string() }).passthrough()).optional(),
  source: z.object({ synthetic: z.boolean().optional(), content_level: z.string().optional() }).passthrough().optional(),
});
export type ContextPacketView = z.infer<typeof ContextPacketView>;

export function readContextPacket(packet: unknown): ContextPacketView | null {
  const parsed = ContextPacketView.safeParse(packet);
  return parsed.success ? parsed.data : null;
}

/** Distinct element kinds, in first-seen order (what the analysis was given). */
export function contextElementKinds(packet: ContextPacketView | null): string[] {
  return [...new Set((packet?.elements ?? []).map((e) => e.kind))];
}

export function readAnalysisOutput(output: unknown): IncidentAnalysis | null {
  const parsed = IncidentAnalysisSchema.safeParse(output);
  return parsed.success ? parsed.data : null;
}
