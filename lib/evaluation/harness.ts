import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffPayloads, type DiffChange } from '@/lib/diff/engine';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { sandboxConnector } from '@/lib/connectors/sandbox';
import type { JsonValue } from '@/lib/hashing/canonicalize';

type Patch = {op:'add'|'remove'|'replace';path:string;value?:JsonValue};
export type ExpectedChange = {canonicalKey:string;changeType:string;fieldPath:string|null;fieldRole:string;flags:string[]};
export type MutationFixture = {
  id:string;
  category:string;
  base:string;
  basePatch?:Patch[];
  mutation:Patch[];
  rawTransform?:'reverse-key-order';
  expected:{changes:ExpectedChange[];field_roles:string[];flags:string[];silent_mutation:boolean;analysis_type:string;material:boolean;min_risk:string;max_risk:string;policy_action:string;serialization_only?:boolean};
};

function pathParts(path:string):string[] {
  if (!path.startsWith('/')) throw new Error(`Invalid JSON Patch path ${path}`);
  return path.slice(1).split('/').map(part => part.replace(/~1/g,'/').replace(/~0/g,'~'));
}

export function applyMutation(base: JsonValue, patches: Patch[]):JsonValue {
  const result=structuredClone(base);
  for (const patch of patches) {
    const parts=pathParts(patch.path);
    let parent: any=result;
    for (const part of parts.slice(0,-1)) {
      if (parent===null || typeof parent!=='object' || !(part in parent)) throw new Error(`Missing patch parent ${patch.path}`);
      parent=parent[part];
    }
    const key=parts.at(-1)!;
    if (parent===null || typeof parent!=='object') throw new Error(`Invalid patch parent ${patch.path}`);
    if (patch.op==='remove') {
      if (!(key in parent)) throw new Error(`Missing patch target ${patch.path}`);
      if (Array.isArray(parent)) parent.splice(Number(key),1); else delete parent[key];
    } else if (patch.op==='replace') {
      if (!(key in parent) || patch.value===undefined) throw new Error(`Missing replacement ${patch.path}`);
      parent[key]=patch.value;
    } else {
      if (patch.value===undefined) throw new Error(`Missing addition ${patch.path}`);
      if (Array.isArray(parent)) parent.splice(Number(key),0,patch.value); else parent[key]=patch.value;
    }
  }
  return result;
}

function reverseKeys(value:JsonValue):JsonValue {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).reverse().map(([key,child])=>[key,reverseKeys(child)]));
  return value;
}

export function evaluateFixture(fixture:MutationFixture) {
  const fixtureBytes=readFileSync(resolve('demo/synthetic-fixtures',fixture.base));
  const baseRaw=fixture.basePatch?.length
    ? Buffer.from(JSON.stringify(applyMutation(JSON.parse(fixtureBytes.toString('utf8')) as JsonValue,fixture.basePatch),null,2)+'\n')
    : fixtureBytes;
  const base=prepareSnapshot(baseRaw);
  const mutated=applyMutation(JSON.parse(baseRaw.toString('utf8')) as JsonValue,fixture.mutation);
  const serialized=fixture.rawTransform==='reverse-key-order' ? reverseKeys(mutated) : mutated;
  const changed=prepareSnapshot(Buffer.from(JSON.stringify(serialized,null,2)+'\n'));
  const changes=diffPayloads(base.payload,changed.payload,sandboxConnector.fieldRoles);
  return {
    sourceId:`eval:${fixture.id}`,
    base,changed,changes,
    silentMutation:base.payload.upstreamVersionLabel===changed.payload.upstreamVersionLabel && base.rawSha256!==changed.rawSha256,
    serializationOnly:base.rawSha256!==changed.rawSha256 && base.canonicalSha256===changed.canonicalSha256,
  };
}

export function loadMutationFixtures():MutationFixture[] {
  const directory=resolve('evaluation/mutations');
  return readdirSync(directory).filter(name=>name.endsWith('.json')).sort().map(name=>JSON.parse(readFileSync(resolve(directory,name),'utf8')) as MutationFixture);
}

export function changeSignature(change:DiffChange|ExpectedChange):string {
  return JSON.stringify([change.canonicalKey,change.fieldPath]);
}
