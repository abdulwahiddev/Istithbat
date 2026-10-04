export type VersionFingerprint = {upstreamLabel:string;rawSha256:string;canonicalSha256:string};

export function classifyObservation(previous:VersionFingerprint|undefined, incoming:VersionFingerprint) {
  if (previous?.rawSha256===incoming.rawSha256) return {status:'NO_CHANGE' as const,silentMutation:false,changeClass:null};
  return {
    status:'NEW_VERSION' as const,
    silentMutation:Boolean(previous && previous.upstreamLabel===incoming.upstreamLabel),
    changeClass:previous && previous.canonicalSha256===incoming.canonicalSha256 ? 'SERIALIZATION_ONLY' as const : null,
  };
}
