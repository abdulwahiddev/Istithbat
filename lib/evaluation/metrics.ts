import { changeSignature, evaluateFixture, type MutationFixture } from './harness';

export function measureMutations(fixtures:MutationFixture[]) {
  let expectedChanges=0, detectedChanges=0, unexpectedChanges=0, correctTypes=0, correctRoles=0, correctFlags=0;
  let silentExpected=0, silentDetected=0, fixturePasses=0;
  const cases=fixtures.map(fixture=>{
    const result=evaluateFixture(fixture);
    const actual=new Map(result.changes.map(change=>[changeSignature(change),change]));
    const expected=new Set(fixture.expected.changes.map(changeSignature));
    let pass=true;
    for (const change of fixture.expected.changes) {
      expectedChanges++;
      const found=actual.get(changeSignature(change));
      if (!found) { pass=false; continue; }
      detectedChanges++;
      if (found.changeType===change.changeType) correctTypes++; else pass=false;
      if (found.fieldRole===change.fieldRole) correctRoles++; else pass=false;
      if (JSON.stringify(found.flags)===JSON.stringify(change.flags)) correctFlags++; else pass=false;
    }
    for (const change of result.changes) if (!expected.has(changeSignature(change))) { unexpectedChanges++; pass=false; }
    if (result.silentMutation!==fixture.expected.silent_mutation || result.serializationOnly!==Boolean(fixture.expected.serialization_only)) pass=false;
    if (fixture.id.startsWith('SM-')) { silentExpected++; if(result.silentMutation) silentDetected++; }
    const roles=[...new Set(result.changes.flatMap(change=>change.rolesPresent??[change.fieldRole]))].sort();
    const flags=[...new Set(result.changes.flatMap(change=>change.flags))].sort();
    if (JSON.stringify(roles)!==JSON.stringify([...fixture.expected.field_roles].sort())) pass=false;
    if (JSON.stringify(flags)!==JSON.stringify([...fixture.expected.flags].sort())) pass=false;
    if (pass) fixturePasses++;
    return {id:fixture.id,pass,expectedChanges:fixture.expected.changes.length,actualChanges:result.changes.length,silentMutation:result.silentMutation,serializationOnly:result.serializationOnly};
  });
  return {suite:'mutations',totalFixtures:fixtures.length,fixturePasses,expectedChanges,detectedChanges,unexpectedChanges,correctTypes,correctRoles,correctFlags,silentExpected,silentDetected,
    exactDetectionRate:expectedChanges ? detectedChanges/expectedChanges : 1,
    typeAccuracy:expectedChanges ? correctTypes/expectedChanges : 1,
    roleAccuracy:expectedChanges ? correctRoles/expectedChanges : 1,
    flagAccuracy:expectedChanges ? correctFlags/expectedChanges : 1,
    cases,aiMetrics:'see separate AI/regression suite',policyActions:'see separate policy-actions suite'};
}
