// Writes a pull request's coverage report into its description, below a separator (docs/ci.md
// "Coverage report"): patch coverage of the lines it changed, and per product it reached, coverage
// against `main`. A description edit notifies no one, where a comment emails every watcher.
//
// The numbers come from CI's own lcov files, not a coverage service: the Tests and editor-shard jobs
// upload each workspace's lcov.info as artifacts named `coverage-<group>-<kind>` (kind `tests`, or
// `editor-<shard>`). The pull request's come from its own run; the base, per artifact kind, from the
// newest `main` run that uploaded that kind (a run on main uploads only the groups it reached).
//
//   node .github/scripts/coverage-report.mjs
//
// Env: PR, HEAD_SHA, BASE_SHA (the pull request's base, for the patch diff), DIFF_HEAD (the commit the run
// tested, whose line numbers the lcov files use: a pull request's merge commit; HEAD_SHA when unset), HEAD_DIR (this run's
// downloaded artifacts, one folder each), GITHUB_REPOSITORY and GH_TOKEN (actions: read and
// pull-requests: write). COVERAGE_REPORT_DRY_RUN=1 prints the report instead of writing it; with
// BASE_DIR set it reads the base artifacts from there instead of from main's runs.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bound the section of the description this script owns, so a later run replaces only that. */
export const REPORT_START = '<!-- liveworkspace:coverage-report:start -->';
export const REPORT_END = '<!-- liveworkspace:coverage-report:end -->';

/** How far back to look through main's CI runs for each artifact kind's base. */
const BASE_RUNS_SCANNED = 50;

const ARTIFACT =
  /^coverage-(livediagram|liveplanner|livedesign|livedocuments|platform)-(tests|editor-\d+)$/;

/** @typedef {{ files: number, lines: number, hits: number, misses: number, partials: number }} Totals */
/** Per file: line → hit count, and `line,block,branch` → whether any report took that branch. */
/** @typedef {Map<string, { lines: Map<number, number>, branchKeys: Map<string, boolean> }>} Coverage */

/** An artifact's group and kind from its name, or null for any other artifact. */
export function parseArtifact(/** @type {string} */ name) {
  const m = ARTIFACT.exec(name);
  return m ? { group: m[1], kind: m[2] } : null;
}

/**
 * Folds an lcov file into `into`. Shards and workspaces overlap on shared files, so a line counts as
 * hit when any report hit it, and a branch as taken when any report took it.
 * @param {string} text
 * @param {Coverage} into
 */
export function mergeLcov(text, into) {
  let file = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const sf = line.slice(3).replace(/\\/g, '/');
      if (!into.has(sf)) into.set(sf, { lines: new Map(), branchKeys: new Map() });
      file = into.get(sf);
    } else if (!file) continue;
    else if (line.startsWith('DA:')) {
      const [ln, hits] = line.slice(3).split(',').map(Number);
      file.lines.set(ln, Math.max(file.lines.get(ln) ?? 0, hits));
    } else if (line.startsWith('BRDA:')) {
      const [ln, block, branch, taken] = line.slice(5).split(',');
      const key = `${ln},${block},${branch}`;
      const was = file.branchKeys.get(key) ?? false;
      file.branchKeys.set(key, was || (taken !== '-' && Number(taken) > 0));
    } else if (line === 'end_of_record') {
      file = null;
    }
  }
  return into;
}

/** Per line: [taken, total] branches, from the merged branch keys. */
function branchesByLine(/** @type {Map<string, boolean>} */ keys) {
  /** @type {Map<number, [number, number]>} */
  const out = new Map();
  for (const [key, taken] of keys) {
    const ln = Number(key.split(',')[0]);
    const [t, n] = out.get(ln) ?? [0, 0];
    out.set(ln, [t + (taken ? 1 : 0), n + 1]);
  }
  return out;
}

/** A line's state as Codecov reckons it: missed, partly covered (some branch never taken), or hit. */
function lineState(/** @type {number} */ hits, /** @type {[number, number] | undefined} */ br) {
  if (hits === 0) return 'misses';
  if (br && br[0] < br[1]) return 'partials';
  return 'hits';
}

/**
 * Totals over the files `include` keeps, and over only the `onlyLines` of each file when given.
 * @param {Coverage} coverage
 * @param {(file: string) => boolean} include
 * @param {Map<string, Set<number>>} [onlyLines]
 * @returns {Totals}
 */
export function totalsOf(coverage, include = () => true, onlyLines) {
  const t = { files: 0, lines: 0, hits: 0, misses: 0, partials: 0 };
  for (const [file, data] of coverage) {
    if (!include(file)) continue;
    const wanted = onlyLines?.get(file);
    if (onlyLines && !wanted) continue;
    const branches = branchesByLine(data.branchKeys);
    let counted = 0;
    for (const [ln, hits] of data.lines) {
      if (wanted && !wanted.has(ln)) continue;
      t[lineState(hits, branches.get(ln))] += 1;
      counted += 1;
    }
    t.lines += counted;
    if (!onlyLines || counted > 0) t.files += 1;
  }
  return t;
}

/** The lines a unified diff (`git diff -U0`) adds, per file, by their new line numbers. */
export function addedLines(/** @type {string} */ diff) {
  /** @type {Map<string, Set<number>>} */
  const out = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4);
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
    } else if (file && line.startsWith('@@')) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!m) continue;
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      if (count === 0) continue;
      if (!out.has(file)) out.set(file, new Set());
      for (let i = 0; i < count; i++) out.get(file).add(start + i);
    }
  }
  return out;
}

/** Coverage in percent, or null when nothing is coverable. */
export function coverageOf(/** @type {Totals} */ t) {
  return t.lines > 0 ? (t.hits / t.lines) * 100 : null;
}

const pct = (/** @type {number | null} */ v) => (v === null ? 'n/a' : `${v.toFixed(2)}%`);

/** A signed change in percentage points, blank when there is none to show. */
export function pctDelta(/** @type {number | null} */ base, /** @type {number | null} */ head) {
  if (base === null || head === null) return '';
  const d = Math.round((head - base) * 100) / 100;
  if (d === 0) return '';
  return `${d > 0 ? '+' : ''}${d.toFixed(2)}%`;
}

/** One line on the lines the pull request changed. */
export function patchLine(/** @type {Totals} */ patch) {
  if (patch.lines === 0) return ':white_check_mark: No coverable lines changed.';
  const missing = patch.misses + patch.partials;
  const cov = pct(coverageOf(patch));
  if (missing === 0)
    return `:white_check_mark: Patch coverage is ${cov}: every changed coverable line is covered.`;
  return `:warning: Patch coverage is ${cov}, with ${missing} changed line${missing === 1 ? '' : 's'} not covered.`;
}

/**
 * The report, as it appears below the separator. A product's `base` is null when no run on main has
 * uploaded its coverage yet (or it has expired).
 * @param {{ pr: number, headSha: string, patch: Totals,
 *   groups: { name: string, kinds: string[], base: Totals | null, baseSha: string | null, head: Totals }[] }} report
 */
export function renderReport({ pr, headSha, patch, groups }) {
  const rows = groups.map((g) => {
    const b = g.base ? coverageOf(g.base) : null;
    const h = coverageOf(g.head);
    const at = g.baseSha ? ` (\`${g.baseSha.slice(0, 7)}\`)` : '';
    return `| ${g.name} | ${pct(b)}${at} | ${pct(h)} | ${pctDelta(b, h)} | ${g.head.misses + g.head.partials} |`;
  });
  return [
    '## Coverage report',
    patchLine(patch),
    `:bar_chart: For the products #${pr} reaches, at \`${headSha.slice(0, 7)}\`, against each one's latest run on \`main\`.`,
    '',
    `| Product | \`main\` | #${pr} | +/- | Lines not covered |`,
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    '<sub>From CI’s own lcov reports (docs/ci.md “Coverage report”). A product’s editor counts only when this run tested it.</sub>',
  ].join('\n');
}

/**
 * The description with the report in its section: replaced in place when present (to the end of the
 * description when the closing marker was edited away), appended below the rest otherwise.
 */
export function withReport(/** @type {string | null} */ body, /** @type {string} */ report) {
  const section = `${REPORT_START}\n\n---\n\n${report}\n\n${REPORT_END}`;
  const text = body ?? '';
  const start = text.indexOf(REPORT_START);
  if (start === -1) {
    const kept = text.trimEnd();
    return kept ? `${kept}\n\n${section}` : section;
  }
  const end = text.indexOf(REPORT_END, start);
  const after = end === -1 ? '' : text.slice(end + REPORT_END.length);
  return `${text.slice(0, start)}${section}${after}`;
}

/** Every lcov.info under `dir`. */
function lcovFiles(/** @type {string} */ dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...lcovFiles(p));
    else if (entry === 'lcov.info') out.push(p);
  }
  return out;
}

/** The coverage in artifact folders `dirs`, merged. */
function coverageIn(/** @type {string[]} */ dirs) {
  /** @type {Coverage} */
  const coverage = new Map();
  for (const dir of dirs)
    for (const f of lcovFiles(dir)) mergeLcov(readFileSync(f, 'utf8'), coverage);
  return coverage;
}

function gh(/** @type {string[]} */ args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

/**
 * For each wanted artifact name, the newest of main's CI runs that still holds it, downloaded into a
 * folder of its own. Returns name → { dir, sha }.
 * @param {string} repo
 * @param {Set<string>} wanted
 */
function downloadBase(repo, wanted) {
  /** @type {Map<string, { dir: string, sha: string }>} */
  const found = new Map();
  const runs = JSON.parse(
    gh([
      'api',
      `repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=${BASE_RUNS_SCANNED}`,
      '--jq',
      '[.workflow_runs[] | {id, sha: .head_sha}]',
    ]),
  );
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-base-'));
  for (const run of runs) {
    if (found.size === wanted.size) break;
    const names = JSON.parse(
      gh([
        'api',
        `repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`,
        '--jq',
        '[.artifacts[] | select(.expired | not) | .name]',
      ]),
    );
    for (const name of names) {
      if (!wanted.has(name) || found.has(name)) continue;
      const dir = path.join(root, name);
      gh(['run', 'download', String(run.id), '--repo', repo, '--name', name, '--dir', dir]);
      found.set(name, { dir, sha: run.sha });
    }
  }
  return found;
}

const PRODUCT_NAMES = {
  livediagram: 'livediagram',
  liveplanner: 'liveplanner',
  livedesign: 'livedesign',
  livedocuments: 'livedocuments',
  platform: 'Platform (packages, liveworkspace)',
};

async function main() {
  const {
    PR,
    HEAD_SHA,
    BASE_SHA,
    DIFF_HEAD,
    HEAD_DIR,
    BASE_DIR,
    GITHUB_REPOSITORY,
    COVERAGE_REPORT_DRY_RUN,
  } = process.env;
  const dryRun = COVERAGE_REPORT_DRY_RUN === '1';
  if (!PR || !HEAD_SHA || !BASE_SHA || !HEAD_DIR || (!dryRun && !GITHUB_REPOSITORY)) {
    console.error(
      'usage: PR=… HEAD_SHA=… BASE_SHA=… HEAD_DIR=… GITHUB_REPOSITORY=… coverage-report.mjs',
    );
    return 2;
  }
  const headArtifacts = readdirSync(HEAD_DIR)
    .map((name) => ({ name, ...parseArtifact(name) }))
    .filter((a) => a.group);
  if (headArtifacts.length === 0) {
    console.log('[coverage-report] this run uploaded no coverage; nothing to report');
    return 0;
  }
  const wanted = new Set(headArtifacts.map((a) => a.name));
  const base = BASE_DIR
    ? new Map(
        readdirSync(BASE_DIR)
          .filter((n) => wanted.has(n))
          .map((n) => [n, { dir: path.join(BASE_DIR, n), sha: 'local' }]),
      )
    : downloadBase(/** @type {string} */ (GITHUB_REPOSITORY), wanted);

  const groupNames = [...new Set(headArtifacts.map((a) => a.group))];
  const groups = groupNames.map((group) => {
    const mine = headArtifacts.filter((a) => a.group === group);
    const head = totalsOf(coverageIn(mine.map((a) => path.join(HEAD_DIR, a.name))));
    // Like with like: the base counts the same artifact kinds, and only when main has all of them.
    const baseHits = mine.map((a) => base.get(a.name));
    const complete = baseHits.every(Boolean);
    const shas = complete ? [...new Set(baseHits.map((b) => b.sha))] : [];
    return {
      name: PRODUCT_NAMES[group],
      kinds: mine.map((a) => a.kind),
      head,
      base: complete ? totalsOf(coverageIn(baseHits.map((b) => b.dir))) : null,
      baseSha: shas.length === 1 && shas[0] !== 'local' ? shas[0] : null,
    };
  });

  const all = coverageIn(headArtifacts.map((a) => path.join(HEAD_DIR, a.name)));
  const diff = execFileSync(
    'git',
    ['diff', '-U0', '--no-color', `${BASE_SHA}...${DIFF_HEAD || HEAD_SHA}`],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const patch = totalsOf(all, () => true, addedLines(diff));

  const report = renderReport({ pr: Number(PR), headSha: HEAD_SHA, patch, groups });
  if (dryRun) {
    console.log(report);
    return 0;
  }
  const repo = /** @type {string} */ (GITHUB_REPOSITORY);
  const body = JSON.parse(gh(['api', `repos/${repo}/pulls/${PR}`, '--jq', '{body}'])).body;
  const next = withReport(body, report);
  if (next === body) {
    console.log(`[coverage-report] #${PR}'s report is unchanged`);
    return 0;
  }
  execFileSync('gh', ['api', '--method', 'PATCH', `repos/${repo}/pulls/${PR}`, '--input', '-'], {
    input: JSON.stringify({ body: next }),
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  console.log(`[coverage-report] wrote the report into #${PR}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
