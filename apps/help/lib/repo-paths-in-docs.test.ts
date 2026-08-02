import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every repo path quoted in specs/ and docs/ must point at a file that exists.
//
// This has been wrong five separate times: a spec naming a component deleted
// in a refactor, one naming a constant that never existed, a setup step telling
// you to replace a placeholder absent from the file, and eight paths whose
// directory changed when apps/live was grouped by domain (spec/57). None of
// them failed anything — a spec is prose, and prose does not compile — so each
// was found by someone going looking, and the eight had been wrong for months.
//
// The rule is the one those fixes converged on. A quoted path passes if it
// resolves verbatim from the repo root, OR under one of the workspace roots
// below: the specs deliberately write `routes/share.ts` for a path inside the
// api worker, which reads correctly in an api spec and should stay. What must
// fail is a path whose named DIRECTORY no longer holds the file —
// `components/FontSelect.tsx` when it lives in `components/palette/`.
//
// It lives in apps/help because this is the documentation app and its suite
// already owns documentation correctness (article-links, the registry guards).
// specs/ belongs to no workspace, and standing up one for a single check would
// cost more machinery than the check.

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const WORKSPACE_ROOTS = [
  '',
  'apps/live/',
  'apps/api/src/',
  'apps/api/',
  'apps/help/',
  'apps/marketing/',
  'apps/mcp/src/',
  'apps/mcp/',
  'apps/telemetry/',
  'apps/router/src/',
  'apps/router/',
  'packages/diagram/',
  'packages/api-schema/',
  'packages/icons/',
  'packages/ui/',
  'packages/templates/',
  'packages/help-registry/',
  'packages/telemetry-client/',
];

// Placeholders and globs the specs use on purpose: a migration filename yet to
// be minted, an elided route segment, a two-files-in-one shorthand.
const DELIBERATE = [/00NN_/, /\/\.\.\.\//, /-1\/2\.ts$/];

const QUOTED_PATH = /`([a-zA-Z0-9_.@/[\]-]+\.(?:ts|tsx|mjs|cjs|js|css|sql|toml|json))`/g;

function docFiles(): string[] {
  const out: string[] = [];
  for (const dir of ['specs', 'docs']) {
    for (const f of readdirSync(`${ROOT}/${dir}`)) {
      if (f.endsWith('.md')) out.push(`${dir}/${f}`);
    }
  }
  out.push('README.md', 'CLAUDE.md');
  return out;
}

function resolves(quoted: string): boolean {
  // A leading slash makes it a URL route, not a repo path — `/api/openapi.json`
  // is an endpoint the api worker serves, not a file anyone can open.
  if (quoted.startsWith('/')) return true;
  if (DELIBERATE.some((re) => re.test(quoted))) return true;
  return WORKSPACE_ROOTS.some((prefix) => existsSync(`${ROOT}/${prefix}${quoted}`));
}

// Bare filenames — `useToast.tsx`, no directory — are the blind spot of the
// check above, which only looks at quotes containing a slash. There are ~240 of
// them, and most that resolve to nothing are deliberate: a file a draft spec
// plans to write, one a spec records as deleted, a `.d.ts` extension written as
// if it were a name, the `useXxx.ts` placeholder in CLAUDE.md. Asserting they
// all exist would mean an allowlist of judgement calls.
//
// So this asserts only the one case that needs no judgement: the name resolves
// with the OTHER TypeScript extension. `.ts` and `.tsx` denote the same kind of
// thing and differ only by whether the file holds JSX, which is exactly why the
// wrong one gets typed — three specs had, one for months. A name that exists
// under no extension at all stays silent; a `.json` beside a `.ts` is a
// generator and its output, not a typo, so only the ts/tsx pair is flipped.
const FLIP: Record<string, string> = { '.ts': '.tsx', '.tsx': '.ts' };

function repoFilenames(): Set<string> {
  const skip = new Set([
    'node_modules',
    '.next',
    '.next-dev',
    'out',
    'dist',
    '.turbo',
    '.git',
    'coverage',
    '.wrangler',
    '.claude',
  ]);
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else names.add(entry);
    }
  };
  walk(ROOT);
  return names;
}

describe('repo paths quoted in specs and docs', () => {
  const files = docFiles();

  it('reads the docs at all (guard against this test going blind)', () => {
    expect(files.length).toBeGreaterThan(100);
    const total = files.reduce(
      (n, f) => n + [...readFileSync(`${ROOT}/${f}`, 'utf8').matchAll(QUOTED_PATH)].length,
      0,
    );
    // Roughly 400 quoted paths when this landed. A collapse toward zero means
    // the pattern stopped matching and every assertion below passes vacuously.
    expect(total).toBeGreaterThan(200);
  });

  it('all point at files that exist', () => {
    const broken: string[] = [];
    for (const f of files) {
      const src = readFileSync(`${ROOT}/${f}`, 'utf8');
      for (const m of src.matchAll(QUOTED_PATH)) {
        const quoted = m[1]!;
        if (quoted.includes('/') && !resolves(quoted)) broken.push(`${f}: ${quoted}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never name a bare file with the wrong TypeScript extension', () => {
    const names = repoFilenames();
    // Guard against the walk silently returning nothing, which would make the
    // assertion below pass without checking anything.
    expect(names.size).toBeGreaterThan(500);

    const wrong: string[] = [];
    for (const f of files) {
      const src = readFileSync(`${ROOT}/${f}`, 'utf8');
      for (const m of src.matchAll(QUOTED_PATH)) {
        const quoted = m[1]!;
        if (quoted.includes('/') || names.has(quoted)) continue;
        const dot = quoted.lastIndexOf('.');
        const other = FLIP[quoted.slice(dot)];
        if (other && names.has(quoted.slice(0, dot) + other)) {
          wrong.push(`${f}: ${quoted} is really ${quoted.slice(0, dot)}${other}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
