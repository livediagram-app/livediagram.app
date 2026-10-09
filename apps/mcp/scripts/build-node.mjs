// The MCP process's bundle (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Delivery"): the same application the Worker runs, bundled for Node 22 with the
// resvg wasm and the Inter font inside it.
//
// The Worker imports those two as modules — wrangler compiles the `.wasm` and
// passes the `.ttf` through as raw bytes (wrangler.toml's Data rule). esbuild's
// `binary` loader is the same idea: each file becomes a Uint8Array in the bundle,
// which is what `createPngRenderer` accepts (render.ts), so no asset has to
// travel beside the bundle and the image needs no second COPY.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: [fileURLToPath(new URL('../src/node/main.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/node.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  loader: { '.wasm': 'binary', '.ttf': 'binary' },
  // A CommonJS dependency inside an ESM bundle still calls require() — the MCP
  // SDK and the wasm bindings do — and Node's ESM loader has none. Same shim as
  // the app process's bundle (apps/server/scripts/build.mjs).
  banner: {
    js: "import{createRequire as __createRequire}from'module';const require=__createRequire(import.meta.url);",
  },
});

console.log('[build] bundled dist/node.mjs');
