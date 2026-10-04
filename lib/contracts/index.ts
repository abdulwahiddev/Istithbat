import { z } from 'zod';
export const VersionStatus=z.enum(['PENDING','ANALYZING','QUARANTINED','TRUSTED','REJECTED','SUPERSEDED']);
export const IncidentStatus=z.enum(['ANALYZING','NEEDS_REVIEW','QUARANTINED','RESOLVED']);
export const RiskLevel=z.enum(['LOW','MEDIUM','HIGH','CRITICAL']);
export const FieldRole=z.enum(['AUTHORITATIVE_TEXT','SCHOLAR_JUDGMENT','PROVENANCE','TRANSLATION','COMMENTARY','OPERATIONAL_METADATA','UNCLASSIFIED']);
export const ContentLevel=z.enum(['A','B','C']);
export const DiffFlag=z.enum(['WHITESPACE_ONLY','UNICODE_EQUIVALENT','HARAKAT_ONLY','PUNCTUATION_ONLY']);
export const RecommendedAction=z.enum(['ALLOW','REVIEW','QUARANTINE','ESCALATE']);
export const AssetImpact=z.enum(['HEALTHY','EXPOSED','STALE','IMPACTED']);
export const PipelineStep=z.enum(['INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR','BLAST_RADIUS','POLICY']);
export const PipelineStatus=z.enum(['PENDING','RUNNING','DONE','FAILED']);
export const NormalizedRecord=z.object({canonical_key:z.string(),upstream_record_id:z.string().optional(),content:z.record(z.string(),z.unknown()),metadata:z.record(z.string(),z.unknown())});
export const SourcePayload=z.object({sourceId:z.string(),upstreamVersionLabel:z.string().optional(),upstreamPublishedAt:z.string().optional(),providerChecksum:z.string().optional(),records:z.array(NormalizedRecord),metadata:z.record(z.string(),z.unknown())});
export type ConnectorDefinition={sourceId:string;fieldRoles:Record<string,z.infer<typeof FieldRole>>;contentLevel:z.infer<typeof ContentLevel>};
export const ApiError=z.object({error:z.object({code:z.string(),message:z.string()})});
export const SourceSummary=z.object({id:z.string(),name:z.string(),provider:z.string(),sourceType:z.string(),connectorHealth:z.string(),isDemoFixture:z.boolean(),contentLevel:ContentLevel,latestSeenLabel:z.string().nullable(),trustedLabel:z.string().nullable(),servedLabel:z.string().nullable(),lastCheckedAt:z.string().nullable().optional()});
export const SourceVersion=z.object({id:z.string(),previousVersionId:z.string().nullable().optional(),upstreamLabel:z.string(),revisionNumber:z.number().int(),upstreamPublishedAt:z.string().nullable().optional(),status:VersionStatus,rawSha256:z.string(),canonicalSha256:z.string(),silentMutation:z.boolean(),changeClass:z.literal('SERIALIZATION_ONLY').nullable().optional(),rawSnapshotPath:z.string().optional(),canonicalSnapshotPath:z.string().optional(),recordCount:z.number().int().optional(),detectedAt:z.string(),heldForReview:z.boolean().optional(),autoPromotion:z.object({policyCode:z.literal('POL-005'),equivalence:z.string(),promotedAt:z.string()}).nullable().optional()});
export const SourceDetail=z.object({source:SourceSummary,fieldRoles:z.record(z.string(),FieldRole),versions:z.array(SourceVersion),changes:z.array(z.object({id:z.string(),canonicalKey:z.string(),changeType:z.string(),fieldPath:z.string().nullable(),fieldRole:FieldRole.nullable(),oldValue:z.unknown(),newValue:z.unknown(),flags:z.array(DiffFlag),fromVersionId:z.string().nullable().optional(),toVersionId:z.string().optional(),oldFieldHash:z.string().nullable().optional(),newFieldHash:z.string().nullable().optional(),rolesPresent:z.array(FieldRole).optional()})),checks:z.array(z.object({id:z.string(),triggerType:z.string(),status:z.string(),errorCode:z.string().nullable(),rawSha256:z.string().nullable(),sourceVersionId:z.string().nullable(),checkedAt:z.string()})).optional()});
export const RegressionComparison=z.object({id:z.string(),question:z.string(),origin:z.enum(['pinned','generated']),oldAnswer:z.string().nullable(),newAnswer:z.string().nullable(),result:z.enum(['NO_CHANGE','NON_MATERIAL_CHANGE','MATERIAL_CHANGE','INCONCLUSIVE','FAILED']).nullable(),oldVersionId:z.string(),newVersionId:z.string()});
export const RegressionDetail=RegressionComparison.extend({incidentId:z.string().nullable(),pipelineRunId:z.string().nullable(),
  protectedAppId:z.string(),batchId:z.string(),sourceId:z.string().nullable(),canonicalKey:z.string().nullable(),
  identityHash:z.string().nullable(),status:z.enum(['PENDING','BASE_DONE','ANSWERS_DONE','COMPLETE','FAILED']),
  questionIndex:z.number().int().nullable(),config:z.unknown().nullable(),modelConfigHash:z.string().nullable(),
  oldRetrieval:z.unknown().nullable(),newRetrieval:z.unknown().nullable(),oldOutput:z.unknown().nullable(),
  newOutput:z.unknown().nullable(),oldMeta:z.unknown().nullable(),newMeta:z.unknown().nullable(),
  comparison:z.unknown().nullable(),comparisonMeta:z.unknown().nullable(),materialChange:z.boolean().nullable(),
  failure:z.unknown().nullable(),createdAt:z.string(),updatedAt:z.string(),completedAt:z.string().nullable()});
export const PipelineStepState=z.object({step:PipelineStep,itemKey:z.string(),status:PipelineStatus,attempts:z.number().int(),errorCode:z.string().nullable(),outputRef:z.string().nullable(),startedAt:z.string().nullable(),completedAt:z.string().nullable()});
export const PipelineRunState=z.object({id:z.string(),sourceVersionId:z.string(),incidentId:z.string().nullable(),status:z.enum(['RUNNING','COMPLETE','FAILED_CLOSED']),fastPath:z.boolean(),leaseUntil:z.string().nullable(),nextStep:PipelineStep.nullable(),steps:z.array(PipelineStepState),createdAt:z.string(),updatedAt:z.string()});
export const IncidentListItem=z.object({id:z.string(),sourceId:z.string(),candidateVersionId:z.string(),status:IncidentStatus,riskLevel:RiskLevel.nullable(),title:z.string(),summary:z.string().nullable(),openedAt:z.string(),pipelineStatus:z.enum(['RUNNING','COMPLETE','FAILED_CLOSED']).nullable(),nextStep:PipelineStep.nullable(),silentMutation:z.boolean(),analysisMode:z.enum(['live','mock','replay']).nullable()});
export const AnalysisSummary=z.object({id:z.string(),analysisType:z.string(),riskLevel:RiskLevel,output:z.unknown(),contextPacketHash:z.string(),meta:z.object({provider:z.string(),model:z.string(),promptVersion:z.string(),mode:z.enum(['live','mock','replay']),recordedAt:z.string().nullable()}).passthrough(),createdAt:z.string()});
export const PolicyEvaluationState=z.object({id:z.string(),sourceVersionId:z.string(),incidentId:z.string().nullable(),policyCode:z.enum(['POL-001','POL-002','POL-003','POL-004','POL-005']).nullable(),deterministic:z.record(z.string(),z.unknown()),advisory:z.record(z.string(),z.unknown()),action:RecommendedAction,evaluatedAt:z.string()});
export const ReviewDecisionState=z.object({id:z.string(),incidentId:z.string(),decision:z.enum(['APPROVE','REJECT','KEEP_QUARANTINED','ESCALATE']),reviewer:z.string(),reason:z.string().nullable(),previousVersionId:z.string().nullable(),candidateVersionId:z.string(),createdAt:z.string()});
export const IncidentAggregate=z.object({id:z.string(),sourceId:z.string(),status:IncidentStatus,riskLevel:RiskLevel.nullable(),effectivePolicyAction:RecommendedAction.nullable(),title:z.string(),summary:z.string().nullable(),candidateVersion:SourceVersion,previousVersion:SourceVersion.nullable(),changes:SourceDetail.shape.changes,contextPacket:z.unknown(),contextPacketHash:z.string(),primaryChangeId:z.string(),analysis:AnalysisSummary.nullable(),regressions:z.array(RegressionComparison),pipeline:PipelineRunState.nullable(),pipelineSteps:z.array(PipelineStepState),policyEvaluation:PolicyEvaluationState.nullable(),reviews:z.array(ReviewDecisionState),blastRadius:z.lazy(()=>BlastRadius).nullable().optional(),audit:z.array(z.unknown())});
export const BlastRadius=z.object({
  incidentId:z.string(),sourceId:z.string(),previousVersionId:z.string().nullable(),candidateVersionId:z.string(),
  incidentStatus:IncidentStatus,policyAction:RecommendedAction.nullable(),trustedVersionId:z.string().nullable(),candidateServed:z.boolean(),
  changes:z.array(z.object({id:z.string(),canonicalKey:z.string(),fieldPath:z.string().nullable(),fieldRole:z.string().nullable()})),
  nodes:z.array(z.object({id:z.string(),name:z.string(),assetType:z.string(),impact:AssetImpact,
    dependencyPaths:z.array(z.array(z.string())),derivationMode:z.enum(['GATEWAY_RESOLVED','MATERIALIZED']).nullable(),
    derivedFromVersionId:z.string().nullable(),currentlyServesCandidate:z.boolean(),servedVersionId:z.string().nullable(),
    regressionEvidence:z.array(z.object({id:z.string(),oldVersionId:z.string(),newVersionId:z.string(),baselineMatchesIncident:z.boolean()})),
    regressionRunIds:z.array(z.string())})),
  edges:z.array(z.object({id:z.string(),from:z.string(),to:z.string(),type:z.string()})),
  counts:z.object({exposed:z.number().int(),stale:z.number().int(),impacted:z.number().int()}),
  traversalHash:z.string(),traversalStatus:z.enum(['PERSISTED','LIVE']),
  history:z.array(z.object({phase:z.enum(['PIPELINE','POST_PROMOTION']),traversalHash:z.string(),computedAt:z.string(),
    counts:z.object({exposed:z.number().int(),stale:z.number().int(),impacted:z.number().int()}),graph:z.unknown()})),
});
export const GatewayVersion=z.object({id:z.string(),label:z.string(),status:VersionStatus});
export const GatewayState=z.object({appId:z.string(),sourceId:z.string(),latestSeen:GatewayVersion,latestTrusted:GatewayVersion.nullable(),served:GatewayVersion,gatewayStatus:z.string()});
export const AuditEvent=z.object({id:z.string(),eventType:z.string(),entityType:z.string(),entityId:z.string(),actor:z.string(),metadata:z.record(z.string(),z.unknown()),createdAt:z.string()});
export const Endpoints={sandboxCurrent:'/api/sandbox/current',sandboxPublish:'/api/sandbox/publish',demoReset:'/api/demo/reset',demoQa:'/api/demo/qa',webhook:'/api/webhooks/source-update',sources:'/api/sources',source:(sourceId:string)=>`/api/sources/${encodeURIComponent(sourceId)}`,sourceCheck:(sourceId:string)=>`/api/sources/${encodeURIComponent(sourceId)}/check`,incidents:'/api/incidents',incident:(incidentId:string)=>`/api/incidents/${encodeURIComponent(incidentId)}`,incidentBlastRadius:(incidentId:string)=>`/api/incidents/${encodeURIComponent(incidentId)}/blast-radius`,incidentRegressions:(incidentId:string)=>`/api/incidents/${encodeURIComponent(incidentId)}/regressions`,incidentReview:(incidentId:string)=>`/api/incidents/${encodeURIComponent(incidentId)}/review`,pipeline:(runId:string)=>`/api/pipeline/${encodeURIComponent(runId)}`,gateway:(appId:string,sourceId:string)=>`/api/gateway/${encodeURIComponent(appId)}/sources/${encodeURIComponent(sourceId)}`};
export type SourceSummary=z.infer<typeof SourceSummary>;
export type SourceDetail=z.infer<typeof SourceDetail>;
export type IncidentAggregate=z.infer<typeof IncidentAggregate>;
export type AnalysisSummary=z.infer<typeof AnalysisSummary>;
export type IncidentListItem=z.infer<typeof IncidentListItem>;
export type PipelineRunState=z.infer<typeof PipelineRunState>;
export type BlastRadius=z.infer<typeof BlastRadius>;
export type GatewayState=z.infer<typeof GatewayState>;
export type AuditEvent=z.infer<typeof AuditEvent>;
