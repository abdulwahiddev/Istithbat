/**
 * The landing's canonical integrity scenario: ONE place to change it.
 *
 * Every section below the hero reads this object (through derive.ts, which runs it through the
 * product's real diff, hashing and policy engines). Swap the record, the values, the answers or
 * the graph here and the page follows without redesign.
 *
 * Status is DRAFT: HadeethEnc record 10618 is being validated as the canonical scenario. While
 * `status` is 'draft' the page labels the scenario as a draft wherever it shows scenario values.
 * Set it to 'validated' (and `regression.answers` to 'recorded' once answers come from a real
 * matched run) after validation.
 *
 * Provenance is explicit and must stay so: `original` is the value as published by HadeethEnc;
 * `mutation` is a controlled test input applied by Istithbat in its sandbox. HadeethEnc never
 * published the mutation, and the page never implies it did.
 */
export type ScenarioStatus = 'draft' | 'validated';

export type Scenario = {
  status: ScenarioStatus;
  source: {
    /** connector id in lib/connectors (its declared field roles classify the change) */
    connectorId: 'hadeethenc';
    name: string;
    publisher: string;
    recordId: string;
    /** public page of the original record */
    href: string;
  };
  /** declared field path inside the normalized record (`ar.grade` = the Arabic response's grade) */
  field: { path: string; label: string };
  original: { value: string; version: string };
  mutation: { value: string; version: string };
  app: { id: string; name: string };
  regression: {
    /** 'illustrative' until the answers are copied from a recorded matched run */
    answers: 'illustrative' | 'recorded';
    question: string;
    oldAnswer: string;
    newAnswer: string;
    /** matched questions for this record, and how many came back materially different */
    matched: number;
    material: number;
    /** product vocabulary (components/strata/semantics.ts DELTA_TEXT keys) */
    delta: string[];
    why: string;
  };
  /** the AI layer's advisory read of the change (advisory only; never an input that lowers policy) */
  advisory: { label: string; recommendedAction: 'ALLOW' | 'REVIEW' | 'QUARANTINE' | 'ESCALATE'; risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
  /**
   * Downstream assets of the record (the product's dependency-graph shape). `from` is the upstream
   * asset; `protected` apps resolve the Trust Gateway; MATERIALIZED assets hold frozen copies.
   */
  assets: { id: string; name: string; type: 'DATASET' | 'RAG_CHUNK' | 'KNOWLEDGE_INDEX' | 'API' | 'APPLICATION'; from: string; mode: 'GATEWAY_RESOLVED' | 'MATERIALIZED'; protected?: boolean }[];
};

export const SCENARIO: Scenario = {
  status: 'draft',
  source: {
    connectorId: 'hadeethenc',
    name: 'HadeethEnc',
    publisher: 'HadeethEnc.com · Encyclopedia of Translated Prophetic Hadiths',
    recordId: '10618',
    href: 'https://hadeethenc.com/ar/browse/hadith/10618',
  },
  field: { path: 'ar.grade', label: 'Grade' },
  original: { value: 'صحيح دون قوله: (ولم يستدر)', version: 'v13' },
  mutation: { value: 'صحيح', version: 'v14' },
  app: { id: 'islamic-qa-demo', name: 'Islamic Q&A' },
  regression: {
    answers: 'illustrative',
    // Filled from the recorded matched run once 10618 is validated (then set answers: 'recorded').
    // Until then the landing shows the comparison setup and "Result pending validation" only.
    question: '',
    oldAnswer: '',
    newAnswer: '',
    matched: 0, // from the recorded run
    material: 0, // from the recorded run
    delta: [],
    why: '',
  },
  advisory: { label: 'Evidence-scope drift', recommendedAction: 'QUARANTINE', risk: 'HIGH' },
  assets: [
    { id: 'dataset', name: 'Evidence Dataset', type: 'DATASET', from: 'record', mode: 'GATEWAY_RESOLVED' },
    { id: 'chunks', name: 'RAG Chunks', type: 'RAG_CHUNK', from: 'dataset', mode: 'GATEWAY_RESOLVED' },
    { id: 'index', name: 'Knowledge Index', type: 'KNOWLEDGE_INDEX', from: 'chunks', mode: 'GATEWAY_RESOLVED' },
    { id: 'qa-api', name: 'Q&A API', type: 'API', from: 'index', mode: 'GATEWAY_RESOLVED' },
    { id: 'qa-app', name: 'Islamic Q&A', type: 'APPLICATION', from: 'qa-api', mode: 'GATEWAY_RESOLVED', protected: true },
    { id: 'search-api', name: 'Search API', type: 'API', from: 'index', mode: 'MATERIALIZED' },
    { id: 'explorer', name: 'Content Explorer', type: 'APPLICATION', from: 'search-api', mode: 'MATERIALIZED' },
  ],
};

/**
 * Production-credibility facts (Section 5). Dated and scoped exactly as docs/technical-evidence.md
 * and docs/submission-readiness.md state them; update them there first, then here.
 */
export const EVIDENCE = {
  auditDate: '6 October 2026',
  production: { hadeethencRecords: 3, quranencAyat: 11 },
  corpus: {
    hadeethArabic: 3574,
    hadeethEnglish: 2328,
    surahs: 114,
    ayat: 6236,
    quranTranslation: 'english_saheeh',
    quranPublisher: 'Noor International Center',
    quranVersion: '1.1.2',
    passes: 2,
  },
  tests: { passed: 188, skipped: 7, skippedNote: 'optional live-database tests' },
  repo: 'https://github.com/abdulwahiddev/Istithbat',
  evidenceDoc: 'https://github.com/abdulwahiddev/Istithbat/blob/main/docs/technical-evidence.md',
  corpusReport: 'https://github.com/abdulwahiddev/Istithbat/blob/main/evaluation/results/2026-10-06-real-corpus.md',
} as const;
