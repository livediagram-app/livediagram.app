// The CLI as one ESM file (docs/specs/015-api/blueprints/cli.md CLI2): dist/livediagram.mjs, every workspace
// package and dependency bundled, for Node 22 and later; beside it the PNG renderer's wasm and font (CLI31), which
// only a render reads, and the font's licence.

import { build } from 'esbuild';
import { chmod, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const outfile = new URL('../dist/livediagram.mjs', import.meta.url).pathname;

await build({
  entryPoints: [new URL('../src/bin.ts', import.meta.url).pathname],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // bin.ts carries the shebang; esbuild keeps it on the first line.
  legalComments: 'none',
  logLevel: 'info',
});
await chmod(outfile, 0o755);

const require = createRequire(import.meta.url);
const dist = new URL('../dist/', import.meta.url).pathname;
const fonts = new URL('../../../packages/render-png/fonts/', import.meta.url).pathname;
for (const [from, to] of [
  [require.resolve('@resvg/resvg-wasm/index_bg.wasm'), 'resvg.wasm'],
  [`${fonts}Inter-Regular.ttf`, 'Inter-Regular.ttf'],
  [`${fonts}Inter-OFL.txt`, 'Inter-OFL.txt'],
])
  await copyFile(from, `${dist}${to}`);
