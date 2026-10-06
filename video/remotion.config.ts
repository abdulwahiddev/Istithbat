import { Config } from '@remotion/cli/config';
import { existsSync } from 'node:fs';
import { webpackOverride } from './webpack-override.mjs';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(20);
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY) || null);

// Use a locally installed Chromium headless shell when present (cloud/CI sandboxes without a
// browser download). Elsewhere Remotion downloads its own.
const local = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(local)) Config.setBrowserExecutable(local);

// Real product components from the app (see webpack-override.mjs).
Config.overrideWebpackConfig(webpackOverride);
