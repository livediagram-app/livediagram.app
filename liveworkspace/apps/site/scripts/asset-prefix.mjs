// After `next build`: the static export writes its assets to out/_next, while every page asks for them under the
// site's assetPrefix (next.config.ts), /_liveworkspace/_next. Moving them there lets liveworkspace.app, a static-assets
// Worker, serve them at that path, and each app's router forward the same path here unchanged.
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The export's folder: out/, or the one given (scripts/build-e2e.mjs builds into .next/out-e2e/).
const out = process.argv[2]
  ? `${fileURLToPath(new URL('../', import.meta.url))}${process.argv[2].replace(/\/?$/, '/')}`
  : fileURLToPath(new URL('../out/', import.meta.url));
const from = `${out}_next`;
const to = `${out}_liveworkspace/_next`;
if (!existsSync(from)) {
  if (existsSync(to)) process.exit(0);
  throw new Error(`no ${from} to move: did next build export?`);
}
rmSync(`${out}_liveworkspace`, { recursive: true, force: true });
mkdirSync(`${out}_liveworkspace`, { recursive: true });
renameSync(from, to);
console.log(`[asset-prefix] ${out}_next -> ${out}_liveworkspace/_next`);
