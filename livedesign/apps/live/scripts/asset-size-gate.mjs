// Fails the build when an exported file is too big for Cloudflare Workers
// Static Assets, which otherwise only refuses it at deploy time
// (docs/specs/016-platform/deployment.md). Run after `next build` on `out/`.
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cloudflare's per-file limit for Workers Static Assets.
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** Every file under `root` larger than `limit` bytes, sorted by path. */
export function oversizedAssets(root, limit = MAX_ASSET_BYTES) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const bytes = statSync(full).size;
        if (bytes > limit) found.push({ path: relative(root, full).split(sep).join('/'), bytes });
      }
    }
  };
  walk(root);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? 'out');
  const over = oversizedAssets(root);
  if (over.length > 0) {
    for (const { path, bytes } of over) {
      console.error(`[asset-gate] too large: ${path} is ${mib(bytes)}`);
    }
    console.error(`[asset-gate] Workers Static Assets allows ${mib(MAX_ASSET_BYTES)} per file`);
    process.exit(1);
  }
  console.log(
    `[asset-gate] ok: no file in ${relative(process.cwd(), root) || '.'} over ${mib(MAX_ASSET_BYTES)}`,
  );
}
