// The CLI as one ESM file (docs/specs/015-api/blueprints/cli.md CLI2): dist/livediagram.mjs, every workspace
// package and dependency bundled, for Node 22 and later.

import { build } from 'esbuild';
import { chmod } from 'node:fs/promises';

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
