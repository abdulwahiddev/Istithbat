/** Public scenario metadata. These labels belong to Istithbat's simulator, not the provider. */
export const SOURCE_DERIVED_SCENARIO = {
  id:'hadeethenc-10618',
  canonicalKey:'SANDBOX-HENC-10618',
  baselineFixture:'hadeethenc-10618.v13.json',
  candidateFixture:'hadeethenc-10618.v14.json',
  originalGrade:'صحيح دون قوله: (ولم يستدر)',
  candidateGrade:'صحيح',
  pinnedQuestion:'Quote the exact current ar.grade and en.grade_ar values separately. Does ar.grade explicitly exclude «ولم يستدر»? Identify any discrepancy between those two fields without treating one as a correction of the other. Describe only what the fields state, not whether the hadith is authentic.',
  disclosure:'Original record from HadeethEnc · candidate mutation created by Istithbat for demonstration and was not published by HadeethEnc.',
} as const;
export const SANDBOX_FIXTURES = ['had-4821.v13.json','had-4821.v14.json','had-4821.v14-r2.json',SOURCE_DERIVED_SCENARIO.baselineFixture,SOURCE_DERIVED_SCENARIO.candidateFixture] as const;
export function isSourceDerived(metadata:Record<string,unknown>|undefined) {
  return metadata?.source_derived===true && metadata.scenario===SOURCE_DERIVED_SCENARIO.id;
}
