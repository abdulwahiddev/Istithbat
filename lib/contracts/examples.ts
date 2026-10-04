import type { SourceSummary, GatewayState, AuditEvent } from './index';
export const sourceExample:SourceSummary={id:'hadith-evidence-sandbox',name:'Hadith Evidence Sandbox',provider:'Istithbat synthetic demo infrastructure',sourceType:'HADITH_EVIDENCE',connectorHealth:'HEALTHY',isDemoFixture:true,contentLevel:'A',latestSeenLabel:'v13',trustedLabel:'v13',servedLabel:'v13'};
export const gatewayExample:GatewayState={appId:'islamic-qa-demo',sourceId:'hadith-evidence-sandbox',latestSeen:null,latestTrusted:null,served:null,gatewayStatus:'SERVING_TRUSTED'};
export const auditExample:AuditEvent={id:'example',eventType:'BASELINE_SEEDED',entityType:'source_version',entityId:'example',actor:'system:seed',metadata:{synthetic:true},createdAt:'2026-10-04T00:00:00Z'};
