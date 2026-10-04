import 'server-only';
import { readAiConfig } from '@/lib/ai/config';
import { TASK_SPECS } from '@/lib/ai';
import { getPrompt } from '@/lib/ai/prompts';
import { sentTemperature, toProviderJsonSchema } from '@/lib/ai/providers';
import { QaAnswerSchema } from '@/lib/ai';
import type { AiMeta } from '@/lib/ai';
import { hashJson, sha256, type JsonValue } from '@/lib/hashing/canonicalize';
import type { RetrievalConfig } from './retrieve';

export function qaConfig(retrievalConfig:RetrievalConfig) {
  const ai=readAiConfig();
  const prompt=getPrompt('QA_ANSWER','v1');
  if(!prompt) throw new Error('REGRESSION_FAILED');
  const provider=ai.mode==='mock'?'mock':ai.provider??'unconfigured';
  const model=ai.mode==='mock'?'mock-v1':ai.model??'unconfigured';
  const temperature=ai.mode==='live'?sentTemperature(provider,model,0):0;
  return {mode:ai.mode,provider,model,temperature,max_tokens:TASK_SPECS.QA_ANSWER.maxTokens,
    system_prompt_hash:sha256(prompt.system),prompt_version:prompt.promptVersion,prompt_id:prompt.promptId,
    retrieval_config:retrievalConfig,output_schema_hash:hashJson(toProviderJsonSchema(QaAnswerSchema) as JsonValue),
    tools:[] as [],effort:TASK_SPECS.QA_ANSWER.effort};
}

export type QaConfig=ReturnType<typeof qaConfig>;

/** D-09's exact model/retrieval tuple, independently of question and version. */
export function modelConfigHash(config:QaConfig):string {
  return hashJson({provider:config.provider,model:config.model,temperature:config.temperature,
    max_tokens:config.max_tokens,system_prompt_hash:config.system_prompt_hash,
    prompt_version:config.prompt_version,retrieval_config:config.retrieval_config} as JsonValue);
}

export function regressionIdentity(input:{incidentId:string;runId:string;sourceId:string;canonicalKey:string;
  baseVersionId:string;candidateVersionId:string;protectedAppId:string;question:string;origin:string;config:QaConfig}) {
  return hashJson({incidentId:input.incidentId,runId:input.runId,sourceId:input.sourceId,
    canonicalKey:input.canonicalKey,baseVersionId:input.baseVersionId,candidateVersionId:input.candidateVersionId,
    protectedAppId:input.protectedAppId,question:input.question,origin:input.origin,
    modelConfigHash:modelConfigHash(input.config),mode:input.config.mode,
    outputSchemaHash:input.config.output_schema_hash,tools:input.config.tools,effort:input.config.effort} as JsonValue);
}

export function assertQaMeta(meta:AiMeta,config:QaConfig):void {
  if(meta.mode!==config.mode||meta.promptId!==config.prompt_id||meta.promptVersion!==config.prompt_version||
    meta.maxTokens!==config.max_tokens||(config.mode!=='replay'&&meta.temperature!==config.temperature)||
    (config.mode!=='replay'&&(meta.provider!==config.provider||meta.model!==config.model)))
    throw new Error('REGRESSION_CONFIG_MISMATCH');
}

export function assertSideMatch(base:AiMeta,candidate:AiMeta):void {
  const fields=(['provider','model','mode','promptId','promptVersion','temperature','maxTokens','effort'] as const);
  if(fields.some(field=>base[field]!==candidate[field])) throw new Error('REGRESSION_CONFIG_MISMATCH');
}
