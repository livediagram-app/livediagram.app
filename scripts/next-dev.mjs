#!/usr/bin/env node
// Shared local-dev entry for the Next.js apps (live, help, ...). Run it
// from an app workspace as `node ../../scripts/next-dev.mjs --port <n>`;
// `cwd` is the app directory, so everything below resolves against it.
//
// It exists because bare `next dev` bit us repeatedly, and in more than
// one app:
//
//  1. The port stays bound after an interrupted `next dev`, so the next
//     start fails with EADDRINUSE and someone chases a stray process.
//  2. The `.next` cache desynchronises after a route restructure or a
//     big file churn, leaving the HMR client asking for chunks the
//     bundler no longer emits ("Cannot find module './257.js'"), or,
//     worse, the `app/layout.css` asset the page <link>s to 404s and the
//     page renders unstyled. The dev server happily serves the broken
//     state until someone wipes the cache by hand. The help centre hit
//     this constantly: ~80 MDX files churned by the docs work (and the
//     background auto-committer renaming files mid-session) outpace what
//     `next dev` reconciles.
//  3. A `next build` anywhere in the same checkout (a repo-root
//     `pnpm build`, a pre-commit suite, a turbo task) overwrites the dev
//     server's `_buildManifest.js.tmp.*` mid-flight, and dev then 500s
//     with `ENOENT: ... _buildManifest.js.tmp.*`.
//
// The cure for all three is the same: free the port, point dev at its own
// `.next-dev/` cache dir (so a concurrent build's `.next/` can never race
// it), and wipe that dir on every start so a corrupted cache never
// survives a restart. Each app's `next.config` reads `NEXT_DISTDIR` and
// falls back to `.next/` when unset, so build / CI keep the default.

import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// `cwd` is the app workspace (pnpm runs the script from there). Resolve
// the app's own `next` binary relative to its package.json so this works
// regardless of how pnpm hoists dependencies.
const appRoot = process.cwd();
const require = createRequire(resolve(appRoot, 'package.json'));

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? Number(args[portIdx + 1]) : NaN;
if (!Number.isInteger(port)) {
  console.error('[dev] usage: next-dev.mjs --port <n> [--webpack]');
  process.exit(1);
}

// Webpack-vs-Turbopack: Turbopack is the better default, its HMR doesn't
// desync the way webpack's does after live edits. But apps that pass JS
// remark/rehype plugins through `@next/mdx` (the help centre uses
// remark-gfm for its pipe tables) must stay on webpack: Turbopack compiles
// MDX with the Rust pipeline, which silently ignores JS plugins, so the
// tables would render as literal text. Those apps pass `--webpack`.
const useWebpack = args.includes('--webpack');

function freePort(p) {
  let pids = '';
  try {
    pids = execSync(`lsof -ti:${p}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // lsof exits non-zero when nothing is bound, nothing to kill.
    return;
  }
  if (!pids) return;
  for (const pid of pids.split(/\s+/)) {
    // Kill children FIRST, `lsof -ti` only returns processes bound to the
    // port, so jest-worker / static-paths-worker etc. are invisible to it.
    // Leaving them alive keeps file handles open on `.next/server`, which
    // races the wipe below and leaves stale `webpack-runtime.js` references
    // to vendor chunks whose pnpm-resolved hashes no longer match: this is
    // empirically the "Cannot find module './vendor-chunks/...'" crash that
    // needs a manual rm -rf to recover from.
    try {
      execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
    } catch {
      // No children, fine.
    }
    try {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    } catch {
      // Already exited between lsof and kill, fine.
    }
  }
  console.log(`[dev] freed port ${p} (killed ${pids.replace(/\s+/g, ', ')} + children)`);
}

// Dev's isolated cache directory (see header comment). Wiped on every
// start so a corrupted cache never survives a restart.
const DEV_DIST_DIR = '.next-dev';
function clearCache() {
  rmSync(resolve(appRoot, DEV_DIST_DIR), { recursive: true, force: true });
}

freePort(port);
clearCache();

// `dev` must stay first, it's the next subcommand; a flag before it is
// parsed as the project directory.
const nextArgs = ['dev', '-p', String(port)];
if (!useWebpack) nextArgs.splice(1, 0, '--turbopack');

// Spawn the locally-installed next CLI with the current Node binary rather
// than shelling out to `pnpm next`. `spawn('pnpm', ...)` ENOENTs on Windows
// (libuv won't resolve the `pnpm.cmd` shim for a bare command without a
// shell, and corepack users have no `pnpm` on PATH at all); going straight
// through node is package-manager- and PATH-agnostic.
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
