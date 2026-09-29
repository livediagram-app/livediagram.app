// Generates the /licences page's data from what each app actually bundles
// (docs/specs/002-project-scope/third-party-licences.md). Runs in the marketing
// build, locally and in CI alike:
//   node packages/licences/scripts/generate.ts --out apps/marketing
// Writes <out>/generated/licences.json and <out>/public/licences/texts/*.txt.
import { spawnSync } from 'node:child_process';
import {
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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeAnalyzeData } from '../src/analyze-data.ts';
import { LICENCE_APPS, type LicenceApp } from '../src/apps.ts';
import { collectWorks, type AppBundle, type Collected, type FileReader } from '../src/collect.ts';
import { EMBEDDED_WORKS } from '../src/embedded-works.ts';
import { LicencesError } from '../src/errors.ts';
import { buildManifest, serialiseManifest } from '../src/manifest.ts';
import { decodeMetafile } from '../src/metafile.ts';
import { OVERRIDES } from '../src/overrides.ts';
import { TEXT_SOURCES, TEXTS_DIR } from '../src/texts.ts';
import { log, logFailure } from './log.ts';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const NEXT_ANALYZE_DISTDIR = '.next-analyze';
const OUTPUT_TAIL_CHARS = 4000;

function argument(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`usage: generate.ts ${name} <dir>`);
  return resolve(value);
}

const reader: FileReader = {
  readText: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  },
  listFiles: (dir) => {
    try {
      return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
    } catch {
      return [];
    }
  },
};

function run(app: LicenceApp, script: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: join(REPO_ROOT, 'apps', app.id),
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

function bundleNext(app: LicenceApp): AppBundle {
  const appDir = join(REPO_ROOT, 'apps', app.id);
  const distDir = join(appDir, NEXT_ANALYZE_DISTDIR);
  rmSync(distDir, { recursive: true, force: true });
  const next = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');
  run(app, next, ['experimental-analyze', '-o'], { NEXT_DISTDIR: NEXT_ANALYZE_DISTDIR });
  const files = findFiles(join(distDir, 'diagnostics', 'analyze', 'data'), 'analyze.data');
  if (files.length === 0) {
    throw new LicencesError('AnalyzeDataMissing', `${app.id}: no analyze.data under ${distDir}`);
  }
  const sources = new Set<string>();
  const assets = new Set<string>();
  for (const file of files) {
    const decoded = decodeAnalyzeData(readFileSync(file));
    decoded.sources.forEach((s) => sources.add(s));
    decoded.assets.forEach((a) => assets.add(a));
  }
  return { app: app.id, sources: [...sources].sort(), assets: [...assets].sort() };
}

function bundleWorker(app: LicenceApp, workDir: string): AppBundle {
  const appDir = join(REPO_ROOT, 'apps', app.id);
  const require = createRequire(join(appDir, 'package.json'));
  const manifestPath = require.resolve('wrangler/package.json');
  const bin = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin: { wrangler: string } }).bin;
  const outDir = join(workDir, app.id);
  const metafile = join(workDir, `${app.id}.meta.json`);
  run(
    app,
    join(dirname(manifestPath), bin.wrangler),
    ['deploy', '--dry-run', '--outdir', outDir, '--metafile', metafile],
    { WRANGLER_SEND_METRICS: 'false' },
  );
  const meta: unknown = JSON.parse(readFileSync(metafile, 'utf8'));
  return {
    app: app.id,
    sources: decodeMetafile(meta, `apps/${app.id}`),
    assets: readdirSync(outDir).sort(),
  };
}

function main() {
  const out = argument('--out');
  const workDir = mkdtempSync(join(tmpdir(), 'livediagram-licences-'));
  const collected: Collected[] = [];
  try {
    for (const app of LICENCE_APPS) {
      const started = Date.now();
      log('licences.bundle.start', { app: app.id, bundler: app.bundler });
      const bundle = app.bundler === 'next' ? bundleNext(app) : bundleWorker(app, workDir);
      log('licences.bundle.done', {
        app: app.id,
        ms: Date.now() - started,
        sources: bundle.sources.length,
        assets: bundle.assets.length,
      });
      const result = collectWorks(bundle, {
        repoRoot: REPO_ROOT,
        textsDir: TEXTS_DIR,
        reader,
        overrides: OVERRIDES,
        embedded: EMBEDDED_WORKS,
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
    overrides: OVERRIDES,
    embedded: EMBEDDED_WORKS,
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

try {
  main();
} catch (error) {
  logFailure(error);
  process.exit(1);
}
