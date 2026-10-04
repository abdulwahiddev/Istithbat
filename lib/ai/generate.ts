import type { z } from 'zod';
import { readAiConfig, type AiConfig } from './config';
import { hashInput } from './hash';
import { lookupMock, type MockEntry } from './mocks';
import { getPrompt, promptIdFor, type PromptTemplate } from './prompts';
import { createProvider, toProviderJsonSchema, type ProviderAdapter, type ProviderMessage } from './providers';
import { readReplay, writeReplay } from './replay/store';
import { TASK_SPECS } from './tasks';
import type { AiFailureReason, AiMeta, AiResult, GenerateRequest } from './types';

/** Temperature is 0 for every task (D-15). */
const TEMPERATURE = 0;

/** Test seams. Production callers never pass these. */
export interface GenerateDeps {
  config?: AiConfig;
  provider?: ProviderAdapter;
  extraMocks?: readonly MockEntry[];
  replayRoot?: string;
  now?: () => number;
}

type Validation<T> = { ok: true; data: T } | { ok: false; errors: string[] };

function validate<S extends z.ZodType>(
  schema: S,
  raw: unknown,
  guard: (output: unknown, input: unknown) => string[],
  input: unknown,
): Validation<z.output<S>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const guardErrors = guard(parsed.data, input);
  return guardErrors.length ? { ok: false, errors: guardErrors } : { ok: true, data: parsed.data };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'empty response' };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, error: 'response is not valid JSON' };
  }
}

/**
 * The single AI entry point (D-15).
 *
 * Never throws for expected failures: malformed output, provider errors, refusals and
 * missing configuration all return `{ ok: false, errorCode }` so the caller keeps the
 * deterministic evidence and the policy step fails closed (Bible §7, §16).
 */
export async function generateStructured<S extends z.ZodType>(
  req: GenerateRequest<S>,
  deps: GenerateDeps = {},
): Promise<AiResult<z.output<S>>> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const config = deps.config ?? readAiConfig();
  const spec = TASK_SPECS[req.task];
  const promptVersion = req.promptVersion ?? spec.defaultPromptVersion;
  const prompt: PromptTemplate | null = getPrompt(req.task, promptVersion);
  const inputHash = hashInput(req.input);

  const meta: AiMeta = {
    provider: config.mode === 'mock' ? 'mock' : (config.provider ?? 'unconfigured'),
    model: config.mode === 'mock' ? 'mock-v1' : (config.model ?? 'unconfigured'),
    promptId: prompt?.promptId ?? promptIdFor(req.task),
    promptVersion,
    temperature: TEMPERATURE,
    maxTokens: spec.maxTokens,
    inputHash,
    latencyMs: 0,
    mode: config.mode,
    attempts: 0,
    recordedAt: null,
    mockMatch: null,
    effort: null,
  };

  const fail = (reason: AiFailureReason, detail: string): AiResult<z.output<S>> => ({
    ok: false,
    errorCode: spec.errorCode,
    reason,
    detail,
    meta: { ...meta, latencyMs: now() - started },
  });
  const succeed = (data: z.output<S>): AiResult<z.output<S>> => ({
    ok: true,
    data,
    meta: { ...meta, latencyMs: now() - started },
  });

  if (!prompt) return fail('UNKNOWN_PROMPT', `no prompt template for ${req.task}@${promptVersion}`);

  // ---------- mock ----------
  if (config.mode === 'mock') {
    const mock = lookupMock(req.task, inputHash, req.input, deps.extraMocks);
    meta.mockMatch = mock.match;
    const v = validate(req.schema, mock.output, spec.guard, req.input);
    return v.ok ? succeed(v.data) : fail('INVALID_OUTPUT', `mock output invalid: ${v.errors.join('; ')}`);
  }

  // ---------- replay ----------
  if (config.mode === 'replay') {
    const rec = readReplay(req.task, prompt.promptId, promptVersion, inputHash, deps.replayRoot);
    if (!rec) return fail('REPLAY_MISSING', `no recorded response for ${req.task} input ${inputHash.slice(0, 12)}`);
    meta.provider = rec.provider;
    meta.model = rec.model;
    meta.temperature = rec.temperature;
    meta.effort = rec.effort;
    meta.maxTokens = rec.maxTokens;
    meta.recordedAt = rec.recordedAt;
    const v = validate(req.schema, rec.output, spec.guard, req.input);
    return v.ok ? succeed(v.data) : fail('INVALID_OUTPUT', `recorded output invalid: ${v.errors.join('; ')}`);
  }

  // ---------- live ----------
  if (!config.provider || !config.model || (!config.apiKey && !deps.provider)) {
    return fail('NOT_CONFIGURED', 'live mode requires AI_PROVIDER, AI_MODEL and <PROVIDER>_API_KEY');
  }
  const provider = deps.provider ?? createProvider(config.provider, config.apiKey as string);
  if (!provider) return fail('NOT_CONFIGURED', `unsupported AI_PROVIDER "${config.provider}"`);

  const jsonSchema = toProviderJsonSchema(req.schema);
  const messages: ProviderMessage[] = [{ role: 'user', content: prompt.renderUser(req.input) }];
  let lastErrors: readonly string[] = [];

  // First attempt + exactly one repair retry on invalid output (D-15).
  for (let attempt = 1; attempt <= 2; attempt++) {
    meta.attempts = attempt;
    const res = await provider.call({
      model: config.model,
      system: prompt.system,
      messages,
      jsonSchema,
      maxTokens: spec.maxTokens,
      temperature: TEMPERATURE,
      effort: spec.effort,
    });
    meta.temperature = res.temperatureSent;
    meta.effort = res.effortSent;
    if (!res.ok) return fail(res.reason, res.detail);

    const json = parseJson(res.text);
    const v = json.ok ? validate(req.schema, json.value, spec.guard, req.input) : ({ ok: false, errors: [json.error] } as const);
    if (v.ok) {
      if (config.recordReplay) {
        writeReplay(
          {
            task: req.task,
            promptId: prompt.promptId,
            promptVersion,
            inputHash,
            provider: provider.name,
            model: config.model,
            temperature: meta.temperature,
            effort: meta.effort,
            maxTokens: spec.maxTokens,
            recordedAt: new Date().toISOString(),
            output: v.data,
          },
          deps.replayRoot,
        );
      }
      return succeed(v.data);
    }
    lastErrors = v.errors;
    if (attempt === 1) {
      messages.push(
        { role: 'assistant', content: res.text || '(empty)' },
        {
          role: 'user',
          content: `Your previous response was rejected:\n- ${v.errors.join('\n- ')}\nReturn one corrected JSON object that satisfies the schema and every rule above. Do not add information that is not in the input.`,
        },
      );
    }
  }
  return fail('INVALID_OUTPUT', `output invalid after repair retry: ${lastErrors.join('; ')}`);
}
