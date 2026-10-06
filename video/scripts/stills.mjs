// Render review stills at given seconds: node scripts/stills.mjs 6 15 27 ...
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const secs = process.argv.slice(2).map(Number);
const browserExecutable = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find(existsSync) ?? null;
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id: 'IstithbatDemo', browserExecutable });
mkdirSync(path.join(root, 'out/stills'), { recursive: true });
for (const s of secs) {
  const output = path.join(root, `out/stills/t${String(s).padStart(5, '0')}.png`);
  await renderStill({ serveUrl, composition, frame: Math.round(s * composition.fps), output, browserExecutable });
  console.log(output);
}
