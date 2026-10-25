// Generates a product's /licences page data from what each of its apps actually bundles
// (docs/specs/002-project-scope/third-party-licences.md in each product). Each product's
// @<product>/licences/scripts/generate.ts calls generateLicences with its own tables; the marketing
// build runs that, locally and in CI alike:
//   node packages/licences/scripts/generate.ts --out apps/marketing
// Writes <out>/generated/licences.json and <out>/public/licences/texts/*.txt.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeAnalyzeData } from '../src/analyze-data.ts';
import { collectWorks, type AppBundle, type Collected } from '../src/collect.ts';
import { LicencesError } from '../src/errors.ts';
import { buildManifest, serialiseManifest } from '../src/manifest.ts';
import { decodeMetafile } from '../src/metafile.ts';
import { nodeReader } from '../src/node-reader.ts';
import { workspaceToProductPath } from '../src/package-path.ts';
import type { EmbeddedWork, LicenceApp, Override } from '../src/tables.ts';
import { TEXT_SOURCES, TEXTS_DIR } from '../src/texts.ts';
import { log, logFailure } from './log.ts';

// Both bundlers report paths from the pnpm workspace root: the nearest folder up from the product
// with a pnpm-workspace.yaml (the monorepo, whose node_modules/.pnpm is the one store).
function findWorkspaceRoot(from: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (dirname(dir) === dir) return from;
  }
}

// What a product hands the generator: its folder and its own tables.
export type LicencesConfig = {
  // The product's folder (the one holding apps/), as a file: URL or a path.
  productRoot: URL | string;
  apps: readonly LicenceApp[];
  overrides: readonly Override[];
  embedded: readonly EmbeddedWork[];
};

type Product = { root: string; dir: string; toProductPath: (path: string) => string };

function product(config: LicencesConfig): Product {
  const root = resolve(
    config.productRoot instanceof URL ? fileURLToPath(config.productRoot) : config.productRoot,
  );
  const dir = relative(findWorkspaceRoot(root), root).split(sep).join('/');
  return { root, dir, toProductPath: (path) => workspaceToProductPath(path, dir) };
}

const NEXT_ANALYZE_DISTDIR = '.next-analyze';
const OUTPUT_TAIL_CHARS = 4000;

function argument(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`usage: generate.ts ${name} <dir>`);
  return resolve(value);
}

function run(
  p: Product,
  app: LicenceApp,
  script: string,
  args: string[],
  env: Record<string, string> = {},
) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: join(p.root, 'apps', app.id),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`;
    throw new LicencesError(
      'BundlerFailed',
      `${app.id} exited ${result.status}:\n${output.slice(-OUTPUT_TAIL_CHARS)}`,
    );
  }
}

function findFiles(dir: string, name: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return findFiles(path, name);
    return entry === name ? [path] : [];
  });
}

function bundleNext(p: Product, app: LicenceApp): AppBundle {
  const appDir = join(p.root, 'apps', app.id);
  const distDir = join(appDir, NEXT_ANALYZE_DISTDIR);
  rmSync(distDir, { recursive: true, force: true });
  const next = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');
  run(p, app, next, ['experimental-analyze', '-o'], { NEXT_DISTDIR: NEXT_ANALYZE_DISTDIR });
  const files = findFiles(join(distDir, 'diagnostics', 'analyze', 'data'), 'analyze.data');
  if (files.length === 0) {
    throw new LicencesError('AnalyzeDataMissing', `${app.id}: no analyze.data under ${distDir}`);
  }
  const sources = new Set<string>();
  const assets = new Set<string>();
  for (const file of files) {
    const decoded = decodeAnalyzeData(readFileSync(file));
    decoded.sources.forEach((s) => sources.add(p.toProductPath(s)));
    decoded.assets.forEach((a) => assets.add(a));
  }
  return { app: app.id, sources: [...sources].sort(), assets: [...assets].sort() };
}

function bundleWorker(p: Product, app: LicenceApp, workDir: string): AppBundle {
  const appDir = join(p.root, 'apps', app.id);
  const require = createRequire(join(appDir, 'package.json'));
  const manifestPath = require.resolve('wrangler/package.json');
  const bin = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin: { wrangler: string } }).bin;
  const outDir = join(workDir, app.id);
  const metafile = join(workDir, `${app.id}.meta.json`);
  run(
    p,
    app,
    join(dirname(manifestPath), bin.wrangler),
    ['deploy', '--dry-run', '--outdir', outDir, '--metafile', metafile],
    { WRANGLER_SEND_METRICS: 'false' },
  );
  const meta: unknown = JSON.parse(readFileSync(metafile, 'utf8'));
  return {
    app: app.id,
    sources: decodeMetafile(meta, `${p.dir ? `${p.dir}/` : ''}apps/${app.id}`).map(p.toProductPath),
    assets: readdirSync(outDir).sort(),
  };
}

function main(config: LicencesConfig) {
  const p = product(config);
  const out = argument('--out');
  const workDir = mkdtempSync(join(tmpdir(), `${basename(p.root)}-licences-`));
  const collected: Collected[] = [];
  try {
    for (const app of config.apps) {
      const started = Date.now();
      log('licences.bundle.start', { app: app.id, bundler: app.bundler });
      const bundle = app.bundler === 'next' ? bundleNext(p, app) : bundleWorker(p, app, workDir);
      log('licences.bundle.done', {
        app: app.id,
        ms: Date.now() - started,
        sources: bundle.sources.length,
        assets: bundle.assets.length,
      });
      const result = collectWorks(bundle, {
        repoRoot: p.root,
        textsDir: TEXTS_DIR,
        reader: nodeReader,
        overrides: config.overrides,
        embedded: config.embedded,
        textSources: TEXT_SOURCES,
      });
      const count = (kind: string) => result.works.filter((w) => w.kind === kind).length;
      log('licences.app.works', {
        app: app.id,
        packages: count('package'),
        vendored: count('vendored'),
        embedded: count('embedded'),
      });
      collected.push(result);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  const { manifest, texts, unused } = buildManifest(collected, {
    apps: config.apps,
    overrides: config.overrides,
    embedded: config.embedded,
  });
  for (const entry of unused) log('licences.table.unused', entry);

  const textsDir = join(out, 'public', 'licences', 'texts');
  rmSync(textsDir, { recursive: true, force: true });
  mkdirSync(textsDir, { recursive: true });
  for (const [hash, text] of texts) writeFileSync(join(textsDir, `${hash}.txt`), text);

  const manifestPath = join(out, 'generated', 'licences.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  const json = serialiseManifest(manifest);
  writeFileSync(manifestPath, json);
  log('licences.manifest.written', {
    works: manifest.sections.reduce((n, s) => n + s.works.length, 0),
    texts: texts.size,
    bytes: json.length,
    path: manifestPath,
  });
}

// Runs the generator for one product and exits non-zero, logged, on any failure.
export function generateLicences(config: LicencesConfig): void {
  try {
    main(config);
  } catch (error) {
    logFailure(error);
    process.exit(1);
  }
}
