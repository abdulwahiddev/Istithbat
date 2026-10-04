import type { ConnectorDefinition } from '@/lib/contracts';
import { sandboxConnector, SANDBOX_ID } from './sandbox';
import { hadeethencConnector } from './hadeethenc';
import { quranencConnector } from './quranenc';
import type { HttpConnector } from './http-connector';

/** Real, read-only HTTP connectors. The sandbox remains the only intentionally mutated source. */
const httpConnectors: Record<string, HttpConnector> = {
  [hadeethencConnector.source.id]: hadeethencConnector,
  [quranencConnector.source.id]: quranencConnector,
};

const registry: Record<string, ConnectorDefinition> = {
  [SANDBOX_ID]: { sourceId: SANDBOX_ID, fieldRoles: sandboxConnector.fieldRoles as ConnectorDefinition['fieldRoles'], contentLevel: sandboxConnector.contentLevel, publishesVersionLabel: true },
  ...Object.fromEntries(Object.values(httpConnectors).map((c) => [c.source.id, c.definition])),
};

export function getConnectorDefinition(sourceId: string): ConnectorDefinition | undefined { return registry[sourceId]; }
export function getHttpConnector(sourceId: string): HttpConnector | undefined { return httpConnectors[sourceId]; }
export function listHttpConnectors(): HttpConnector[] { return Object.values(httpConnectors); }
