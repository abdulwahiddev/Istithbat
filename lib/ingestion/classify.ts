export type VersionFingerprint = {upstreamLabel:string;rawSha256:string;canonicalSha256:string};

/** `labelPublished=false` (provider publishes no version): a changed fingerprint is still a new version, but is never called a Silent Mutation of a label the provider never issued. */
export function classifyObservation(previous:VersionFingerprint|undefined, incoming:VersionFingerprint, options:{labelPublished?:boolean}={}) {
  if (previous?.rawSha256===incoming.rawSha256) return {status:'NO_CHANGE' as const,silentMutation:false,changeClass:null};
  return {
    status:'NEW_VERSION' as const,
    silentMutation:Boolean(previous && options.labelPublished!==false && previous.upstreamLabel===incoming.upstreamLabel),
    changeClass:previous && previous.canonicalSha256===incoming.canonicalSha256 ? 'SERIALIZATION_ONLY' as const : null,
  };
}
