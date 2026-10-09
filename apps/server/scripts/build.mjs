import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// The app process ships as one bundle (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Delivery"): the sources import workspace packages by bare specifier, which
// Node's ESM resolver only accepts once they are bundled, and a single file is
// what the container runs.

const out = fileURLToPath(new URL('../dist/main.mjs', import.meta.url));

await build({
  entryPoints: [fileURLToPath(new URL('../src/main.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: out,
  // A CommonJS dependency inside an ESM bundle still calls require() — \`ws\` does,
  // for node built-ins — and Node's ESM loader has none. This is the shim that
  // makes those calls resolve, and it is why the bundle needs no node_modules at
  // runtime.
  banner: {
    js: "import{createRequire as __createRequire}from'module';const require=__createRequire(import.meta.url);",
  },
});

// The migrations ride beside the bundle: \`import.meta.url\` moves when the process
// runs from dist, so the directory is copied rather than computed.
const from = fileURLToPath(new URL('../../api/migrations/', import.meta.url));
const to = fileURLToPath(new URL('../dist/migrations/', import.meta.url));
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });

console.log('[build] bundled dist/main.mjs with the migrations beside it');
