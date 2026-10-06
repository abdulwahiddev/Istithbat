// Shared by remotion.config.ts (CLI render/studio) and scripts/stills.mjs (programmatic bundle).
// The video renders the product's REAL components (components/**, lib/**) from the app at the repo
// root: `@/` resolves there, exactly as in the Next.js app. Bare packages (react, zod) resolve from
// this project's node_modules, and the Next.js runtime imports get inert shims.
import path from 'node:path';

// Run from the video/ directory (npm scripts do this); the CLI bundles this file as CJS, so no import.meta.
const here = process.cwd();
const repo = path.resolve(here, '..');

/** @param {import('webpack').Configuration} c */
export const webpackOverride = (c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    modules: [path.join(here, 'node_modules'), 'node_modules'],
    alias: {
      ...(c.resolve?.alias ?? {}),
      '@': repo,
      'next/link': path.join(here, 'src/shims/next-link.tsx'),
      'next/navigation': path.join(here, 'src/shims/next-navigation.ts'),
      'server-only': path.join(here, 'src/shims/server-only.ts'),
    },
  },
});
