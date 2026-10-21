// Bundles demo-entry.ts (and, through it, the sticky-vision source) into
// sticky-vision.bundle.js for index.html. Run from the repo root:
// pnpm demo:sticky-vision:build
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

await build({
  entryPoints: [`${HERE}demo-entry.ts`],
  outfile: `${HERE}sticky-vision.bundle.js`,
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  logLevel: 'info',
});
