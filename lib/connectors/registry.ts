import type { ConnectorDefinition } from '@/lib/contracts';
import { sandboxConnector, SANDBOX_ID } from './sandbox';
const registry:Record<string,ConnectorDefinition>={
  [SANDBOX_ID]:{sourceId:SANDBOX_ID,fieldRoles:sandboxConnector.fieldRoles as ConnectorDefinition['fieldRoles'],contentLevel:sandboxConnector.contentLevel},
};
export function getConnectorDefinition(sourceId:string):ConnectorDefinition | undefined { return registry[sourceId]; }
