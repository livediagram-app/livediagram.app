#!/usr/bin/env node
// Builds the one help centre once per scope (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The
// build"): for each scope it writes the generated files that make the build that scope's (lib/scope.generated.ts,
// lib/bindings.generated.ts, editions/current.generated.ts, app/scope.generated.css), runs `next build`, and moves
// the static export from out/ to dist/<scope>/. All Apps builds first: its /scope-manifest.json becomes
// dist/manifest.json, the help Worker's map, and each app's build then drops the article and landing pages that do
// not apply to it (the Worker answers those addresses with a 308 before a file is looked up). The checked-in
// defaults (livediagram's) are put back at the end, built or failed.
//
//   node scripts/build-scopes.mjs                  every scope, into dist/
//   node scripts/build-scopes.mjs --only=all,livedesign
//   node scripts/build-scopes.mjs --write-scope    write HELP_SCOPE's generated files and stop (`pnpm dev`'s predev)
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'];
const SCOPES = ['all', ...APPS];
const DEFAULT_SCOPE = 'livediagram';

// Each scope's theme package and print colours (fixed to its brand, so paper does not follow the reader's theme).
const THEMES = {
  livediagram: { theme: '@liveworkspace/tailwind-config', print: ['#0369a1', '#0ea5e9'] },
  liveplanner: { theme: '@liveplanner/tailwind-config', print: ['#6d28d9', '#8b5cf6'] },
  livedocuments: { theme: '@livedocuments/tailwind-config', print: ['#a34a0c', '#a34a0c'] },
  livedesign: { theme: '@livedesign/tailwind-config', print: ['#be123c', '#be123c'] },
  livehuddle: { theme: '@livehuddle/tailwind-config', print: ['#047857', '#10b981'] },
  all: { theme: '@liveworkspace/tailwind-config', print: ['#334155', '#64748b'] },
};

const NOTE =
  "Written by scripts/build-scopes.mjs for each build (and by `pnpm dev`'s predev step from HELP_SCOPE). The\n" +
  "checked-in copy is livediagram's, so a plain `next dev` works. Do not edit by hand.";
const tsNote = NOTE.split('\n')
  .map((l) => `// ${l}`)
  .join('\n');
const cssNote = `/* ${NOTE.split('\n').join('\n * ')} */`;

/** The generated files for `scope`, by path under the app. */
export function generatedFiles(scope) {
  const { theme, print } = THEMES[scope];
  const css =
    scope === 'all'
      ? `@import '${theme}';\n@import '../editions/all/theme.css';\n`
      : `@import '${theme}';\n@source '../../../../${scope}/packages/ui/src';\n@import '@${scope}/ui/hero-band.css';\n`;
  return {
    'lib/scope.generated.ts': `${tsNote}\nimport type { HelpScope } from '@liveworkspace/help-registry';\n\nexport const SCOPE: HelpScope = '${scope}';\n`,
    'lib/bindings.generated.ts': `${tsNote}\nexport * from './bindings/${scope}';\n`,
    'editions/current.generated.ts': `${tsNote}\nexport { default as EDITION } from './${scope}/edition';\n`,
    'app/scope.generated.css': `${cssNote}\n${css}\n:root {\n  --help-print-link: ${print[0]};\n  --help-print-section: ${print[1]};\n}\n`,
  };
}

// Each scope's favicon, copied to app/icon.svg and app/icon.png (Next serves them under /help): an app's from its
// edition (editions/<scope>/icon.*). All Apps' are liveworkspace.app's slate prism (apps/site/app/icon.svg) and a
// 256px PNG of it, checked in beside its edition (the site draws its PNGs at export, from a route, not a file).
export function iconSources(scope) {
  return {
    'app/icon.svg': `editions/${scope}/icon.svg`,
    'app/icon.png': `editions/${scope}/icon.png`,
  };
}

function writeScope(scope) {
  if (!SCOPES.includes(scope)) throw new Error(`[build-scopes] not a scope: ${scope}`);
  for (const [path, source] of Object.entries(iconSources(scope))) {
    const from = readFileSync(join(APP, source));
    const file = join(APP, path);
    if (!existsSync(file) || !readFileSync(file).equals(from)) writeFileSync(file, from);
  }
  for (const [path, text] of Object.entries(generatedFiles(scope))) {
    const file = join(APP, path);
    // Unchanged files stay untouched, so a dev server's watcher does not rebuild for nothing.
    if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
    writeFileSync(file, text);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: APP, stdio: 'inherit', env: process.env });
  if (result.status !== 0)
    throw new Error(`[build-scopes] ${command} ${args.join(' ')} failed (${result.status})`);
}

/** Drops from an app's export the pages of articles and landings that do not apply to it. */
function prune(dir, scope, manifest) {
  const drop = [
    ...Object.entries(manifest.articles),
    ...Object.entries(manifest.categories),
  ].filter(([, apps]) => apps.length > 0 && !apps.includes(scope));
  for (const [route] of drop) {
    for (const file of ['index.html', 'index.txt']) rmSync(join(dir, route, file), { force: true });
    rmSync(join(dir, 'og', `${route}.png`), { force: true });
  }
  return drop.length;
}

function build(scopes) {
  const dist = join(APP, 'dist');
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  let manifest = null;
  for (const scope of scopes) {
    console.log(`[build-scopes] ${scope}`);
    writeScope(scope);
    rmSync(join(APP, 'out'), { recursive: true, force: true });
    run('next', ['build']);
    const target = join(dist, scope);
    renameSync(join(APP, 'out'), target);
    const own = join(target, 'scope-manifest.json');
    if (scope === 'all') {
      cpSync(own, join(dist, 'manifest.json'));
      manifest = JSON.parse(readFileSync(own, 'utf8'));
    }
    rmSync(own, { force: true });
    if (scope !== 'all')
      console.log(`[build-scopes] ${scope}: ${prune(target, scope, manifest)} pages dropped`);
  }
}

// Run only as a script: importing the module (a test reading generatedFiles) builds nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes('--write-scope')) {
    writeScope(process.env.HELP_SCOPE || DEFAULT_SCOPE);
  } else {
    const only = args
      .find((a) => a.startsWith('--only='))
      ?.slice('--only='.length)
      .split(',');
    // All Apps always builds first: its manifest is the Worker's map and each app's prune list.
    const scopes = ['all', ...APPS.filter((s) => !only || only.includes(s))];
    try {
      build(scopes);
    } finally {
      writeScope(DEFAULT_SCOPE);
    }
  }
}
