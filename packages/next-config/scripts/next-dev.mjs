#!/usr/bin/env node
// Shared local-dev entry for every product's Next.js apps (editor, help, marketing, ...). Run it from an
// app workspace as `node ../../../packages/next-config/scripts/next-dev.mjs --port <n> [--force] [--webpack]`;
// `cwd` is the app directory, so everything below resolves against it.
//
// It exists because bare `next dev` bit us repeatedly, and in more than
// one app:
//
//  1. The port stays bound after an interrupted `next dev`, so the next
//     start fails with EADDRINUSE and someone chases a stray process.
//     The script used to kill whatever held the port, which also stopped
//     other sessions' dev stacks on this shared machine; it now refuses
//     and names the holder (port-guard.js), and kills it only on --force.
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
// The cures: name the port's holder (1), and point dev at its own `.next-dev/` cache
// dir (3) so a concurrent build's `.next/` can never race it. The shared
// config (@liveworkspace/next-config) reads `NEXT_DISTDIR` and falls back to
// `.next/` when unset, so build / CI keep the default. (2) was the webpack-era
// dev cache; Turbopack's file-system cache reconciles a route restructure
// itself, so the cache is kept between starts and `turbopackGc` keeps it lean
// (docs/specs/016-platform/nextjs.md "The Turbopack cache").

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { guardPort } from './port-guard.js';

// `cwd` is the app workspace (pnpm runs the script from there). Resolve
// the app's own `next` binary relative to its package.json so this works
// regardless of how pnpm hoists dependencies.
const appRoot = process.cwd();
const require = createRequire(resolve(appRoot, 'package.json'));

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? Number(args[portIdx + 1]) : NaN;
if (!Number.isInteger(port)) {
  console.error('[dev] usage: next-dev.mjs --port <n> [--force] [--webpack]');
  process.exit(1);
}

// Webpack-vs-Turbopack: Turbopack is the default everywhere (and since
// Next 16 it's what `next build` uses too, so dev matching it is what
// ships). The help centre used to be pinned to `--webpack` because
// Turbopack's Rust MDX pipeline ignores remark/rehype plugins passed as
// imported JS functions; it now names remark-gfm as a string in its
// `next.config.ts` instead, which Turbopack resolves itself. The flag
// stays as a diagnostic escape hatch, nothing passes it by default.
const useWebpack = args.includes('--webpack');

// Dev's isolated cache directory (see header comment), kept between starts.
const DEV_DIST_DIR = '.next-dev';

// Refuse a port another process holds; `--force` kills the holder instead.
const guard = await guardPort(port, { force: args.includes('--force') });
if (!guard.ok) {
  console.error(guard.message);
  process.exit(1);
}

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
