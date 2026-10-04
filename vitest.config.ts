import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({resolve:{alias:{'server-only':resolve('tests/server-only-shim.ts'),'@':resolve('.')}},test:{environment:'node'}});
