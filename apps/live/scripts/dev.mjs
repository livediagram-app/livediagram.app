#!/usr/bin/env node
// Robust local dev entry. Three sources of friction with the bare
// `next dev` invocation were biting us repeatedly:
//
//  1. Port 3002 stays bound after an interrupted `next dev`, so the
//     next start fails with EADDRINUSE and someone has to chase down
//     a stray process by hand.
//  2. The `.next` cache occasionally desynchronises after a route
//     restructure or a shared-import shuffle, leaving the HMR client
//     asking for chunks the bundler no longer emits ("Cannot find
//     module './257.js'"). The dev server happily serves 500s until
//     someone wipes it.
//  3. Wrapping the same logic in package.json's `"dev"` field with
//     shell pipelines is fragile across macOS / Linux xargs flavours.
//
// This script normalises the startup: free the port, clear the
// cache, then exec next dev with the requested bundler flags.

import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const appRoot = resolve(__dirname, '..');
const PORT = 3002;

function freePort(port) {
  let pids = '';
  try {
    pids = execSync(`lsof -ti:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // lsof exits non-zero when nothing is bound — nothing to kill.
    return;
  }
  if (!pids) return;
  for (const pid of pids.split(/\s+/)) {
    // Kill children FIRST — `lsof -ti` only returns processes bound
    // to the port, so jest-worker / static-paths-worker etc. are
    // invisible to it. Leaving them alive keeps file handles open
    // on `.next/server`, which races the wipe below and leaves
    // stale `webpack-runtime.js` references to vendor chunks whose
    // pnpm-resolved hashes no longer match. Empirically that's the
    // "Cannot find module './vendor-chunks/...'" crash that needs
    // a manual rm -rf .next to recover from.
    try {
      execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
    } catch {
      // No children — fine.
    }
    try {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    } catch {
      // Already exited between lsof and kill — fine.
    }
  }
  console.log(`[dev] freed port ${port} (killed ${pids.replace(/\s+/g, ', ')} + children)`);
}

// Isolate dev's cache directory from build's. Without this split,
// a `next build` running anywhere in the same checkout (pre-commit
// suite, ad-hoc verification, turbo task) overwrites the dev
// server's `_buildManifest.js.tmp.*` mid-flight and dev then 500s
// with `ENOENT: ... _buildManifest.js.tmp.*` until someone wipes
// the cache by hand. `next.config.ts` reads `NEXT_DISTDIR` and
// falls back to `.next/` when it's unset, so the env var here is
// the only place dev's directory is reassigned — build / CI keep
// the default.
const DEV_DIST_DIR = '.next-dev';

function clearCache() {
  rmSync(resolve(appRoot, DEV_DIST_DIR), { recursive: true, force: true });
}

freePort(PORT);
clearCache();

// Turbopack is the default bundler now. Webpack's HMR repeatedly
// desynchronises after live edits and serves
// `__webpack_modules__[moduleId] is not a function` until someone
// wipes `.next` and restarts — even with the persistent FS cache
// already disabled in `next.config.ts` and child workers killed
// cleanly here. Turbopack (stable in Next 15) sidesteps that whole
// class of failure. Opt back into webpack only when something
// Turbopack genuinely doesn't support.
const useWebpack = process.argv.includes('--webpack');
// `dev` must stay first — it's the next subcommand; a flag before it is
// parsed as the project directory.
const nextArgs = ['dev', '-p', String(PORT)];
if (!useWebpack) nextArgs.splice(1, 0, '--turbopack');

// Spawn the locally-installed next CLI with the current Node binary
// rather than shelling out to `pnpm next`. `spawn('pnpm', ...)` ENOENTs
// on Windows (libuv won't resolve the `pnpm.cmd` shim for a bare command
// without a shell, and corepack users have no `pnpm` on PATH at all), and
// going straight through node is package-manager- and PATH-agnostic, so
// the dev server starts identically on every OS.
const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: 'inherit',
  cwd: appRoot,
  env: { ...process.env, NEXT_DISTDIR: DEV_DIST_DIR },
});
child.on('exit', (code) => process.exit(code ?? 0));

// Forward SIGINT / SIGTERM so Ctrl+C in the parent kills next cleanly.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
