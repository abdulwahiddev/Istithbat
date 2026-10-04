import 'server-only';
import { generateStructured, IncidentAnalysisSchema, type GenerateDeps } from '@/lib/ai';
import type { ContextPacket } from './context';

/** Packet 03's callable analyzer for the evaluation harness. */
export function analyze(packet: ContextPacket, deps?: GenerateDeps) {
  return generateStructured({task:'INCIDENT_ANALYSIS',schema:IncidentAnalysisSchema,input:packet,promptVersion:'v1'},deps);
}
