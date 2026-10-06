// Writes the pull request's coverage report into its description, below a separator: the coverage
// diff against its base and a row per area of the repo (docs/specs/003-system-architecture/testing.md
// "Coverage report"). A description edit notifies no one, where a comment emails every watcher. The
// numbers are Codecov's, read from its public API; Codecov's own comment is off, because the free plan
// this organisation is on writes a fixed patch-only one whatever codecov.yml asks for.
//
//   node scripts/coverage-report.mjs <pr-number> <head-sha>
//
// Needs GITHUB_TOKEN (pull-requests: write) and GITHUB_REPOSITORY; COVERAGE_REPORT_DRY_RUN=1 prints
// the report instead of writing it, and needs no token. Run by coverage-report.yml after CI
// succeeds; it never checks out or runs the pull request's code.

import { fileURLToPath } from 'node:url';

/** Areas of the repo, one row each; a file belongs to the first area whose path prefixes it. */
export const AREAS = [
  { name: 'Editor', paths: ['apps/live'] },
  { name: 'API', paths: ['apps/api'] },
  { name: 'MCP', paths: ['apps/mcp'] },
  { name: 'Help and marketing', paths: ['apps/help', 'apps/marketing'] },
  { name: 'Packages', paths: ['packages'] },
];

/** Uploads CI makes per commit (codecov.yml `after_n_builds`): Tests and three editor shards. */
export const EXPECTED_SESSIONS = 4;

/** Bound the section of the description this script owns, so a later run replaces only that. */
export const REPORT_START = '<!-- livediagram:coverage-report:start -->';
export const REPORT_END = '<!-- livediagram:coverage-report:end -->';

const CODECOV_API = 'https://api.codecov.io/api/v2/github';
const CODECOV_GRAPHQL = 'https://api.codecov.io/graphql/gh';
const POLL_INTERVAL_MS = 10_000;
const POLL_ATTEMPTS = 30;
/** Network failures the poll rides out before giving up: a dropped connection, not a dead certificate. */
const NETWORK_RETRIES = 3;

/** @typedef {{ files: number, lines: number, hits: number, misses: number, partials: number }} Totals */

/** Sums totals across paths; coverage is hits over coverable lines, as Codecov reckons it. */
export function sumTotals(/** @type {Totals[]} */ parts) {
  const sum = { files: 0, lines: 0, hits: 0, misses: 0, partials: 0 };
  for (const p of parts) {
    for (const key of Object.keys(sum)) sum[key] += p[key] ?? 0;
  }
  return sum;
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

function countDelta(/** @type {number} */ base, /** @type {number} */ head) {
  const d = head - base;
  if (d === 0) return '';
  return `${d > 0 ? '+' : ''}${d}`;
}

/**
 * Codecov's "Coverage Diff" block: a `diff` fence whose `+` / `-` gutter marks a row that got better
 * or worse (more hits, fewer misses and partials, higher coverage).
 */
export function coverageDiffBlock(
  /** @type {Totals} */ base,
  /** @type {Totals} */ head,
  /** @type {string} */ baseLabel,
  /** @type {string} */ headLabel,
) {
  const baseCov = coverageOf(base);
  const headCov = coverageOf(head);
  const rows = [
    ['Coverage', pct(baseCov), pct(headCov), pctDelta(baseCov, headCov), sign(baseCov, headCov, 1)],
    null,
    ['Files', base.files, head.files, countDelta(base.files, head.files), ' '],
    ['Lines', base.lines, head.lines, countDelta(base.lines, head.lines), ' '],
    null,
    ['Hits', base.hits, head.hits, countDelta(base.hits, head.hits), sign(base.hits, head.hits, 1)],
    [
      'Misses',
      base.misses,
      head.misses,
      countDelta(base.misses, head.misses),
      sign(base.misses, head.misses, -1),
    ],
    [
      'Partials',
      base.partials,
      head.partials,
      countDelta(base.partials, head.partials),
      sign(base.partials, head.partials, -1),
    ],
  ];
  const w = [10, 10, 10, 9];
  const line = (/** @type {string} */ g, /** @type {unknown[]} */ cells) =>
    `${g} ${String(cells[0]).padEnd(w[0])}${String(cells[1]).padStart(w[1])}${String(cells[2]).padStart(w[2])}${String(cells[3]).padStart(w[3])}`;
  const width = 2 + w.reduce((a, b) => a + b, 0);
  const rule = '='.repeat(width);
  const title = 'Coverage Diff';
  const pad = Math.max(0, width - title.length - 6);
  const out = [
    '```diff',
    `@@${' '.repeat(Math.floor(pad / 2))} ${title} ${' '.repeat(Math.ceil(pad / 2))}@@`,
    `## ${''.padEnd(w[0] - 1)}${baseLabel.padStart(w[1])}${headLabel.padStart(w[2])}${'+/-'.padStart(w[3])}`,
    rule,
  ];
  for (const row of rows) out.push(row === null ? rule : line(String(row[4]), row));
  out.push('```');
  return out.join('\n');
}

/** `+` when the change is an improvement, `-` when it is a regression, ` ` otherwise. */
function sign(
  /** @type {number | null} */ base,
  /** @type {number | null} */ head,
  /** @type {1 | -1} */ better,
) {
  if (base === null || head === null) return ' ';
  const d = Math.round((head - base) * 100) / 100;
  if (d === 0) return ' ';
  return d * better > 0 ? '+' : '-';
}

/** One line on the lines the pull request changed. */
export function patchLine(
  /** @type {{ hits: number, misses: number, partials: number } | null} */ patch,
) {
  const total = patch ? patch.hits + patch.misses + patch.partials : 0;
  if (!patch || total === 0) return ':white_check_mark: No coverable lines changed.';
  const missing = patch.misses + patch.partials;
  const cov = pct((patch.hits / total) * 100);
  if (missing === 0)
    return `:white_check_mark: Patch coverage is ${cov}: every changed coverable line is covered.`;
  return `:warning: Patch coverage is ${cov}, with ${missing} changed line${missing === 1 ? '' : 's'} not covered.`;
}

/**
 * Codecov's impacted file tree graph for the pull request, linked to its file tree; null without a
 * graph token (Codecov's public token for embedding graphs and badges).
 */
export function treeGraph(
  /** @type {string} */ codecovUrl,
  /** @type {string | null} */ graphToken,
) {
  if (!graphToken) return null;
  const svg = `${codecovUrl}/graphs/tree.svg?width=650&height=150&src=pr&token=${encodeURIComponent(graphToken)}`;
  return `[![Impacted file tree graph](${svg})](${codecovUrl}?src=pr&el=tree)`;
}

/**
 * The report, as it appears below the separator.
 * @param {{ pr: number, baseSha: string, headSha: string, base: Totals, head: Totals,
 *   patch: { hits: number, misses: number, partials: number } | null,
 *   areas: { name: string, base: Totals, head: Totals }[], codecovUrl: string,
 *   graphToken?: string | null }} report
 */
export function renderReport(report) {
  const { pr, baseSha, headSha, base, head, patch, areas, codecovUrl, graphToken = null } = report;
  const tree = treeGraph(codecovUrl, graphToken);
  const baseCov = coverageOf(base);
  const headCov = coverageOf(head);
  const delta = pctDelta(baseCov, headCov);
  const rows = areas.map((a) => {
    const b = coverageOf(a.base);
    const h = coverageOf(a.head);
    return `| ${a.name} | ${pct(b)} | ${pct(h)} | ${pctDelta(b, h)} |`;
  });
  return [
    `## [Coverage](${codecovUrl}) report`,
    patchLine(patch),
    `:bar_chart: Project coverage is ${pct(headCov)}${delta ? ` (${delta})` : ''}, comparing \`main\` at \`${baseSha.slice(0, 7)}\` with \`${headSha.slice(0, 7)}\`.`,
    ...(tree ? ['', tree] : []),
    '',
    `| Area | \`main\` | #${pr} | +/- |`,
    '| --- | ---: | ---: | ---: |',
    ...rows,
    '',
    coverageDiffBlock(base, head, 'main', `#${pr}`),
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

/** Why a call failed: the message, with the network cause undici keeps behind "fetch failed". */
export function failureReason(/** @type {unknown} */ error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause : null;
  if (!cause) return error.message;
  const code = /** @type {{ code?: unknown }} */ (cause).code;
  return `${error.message} (${typeof code === 'string' ? `${code}: ` : ''}${cause.message})`;
}

/** fetch, failing with the method, the URL and the cause, so a log names what could not be reached. */
async function call(/** @type {string} */ url, /** @type {RequestInit} */ init = {}) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${failureReason(error)}`);
  }
}

async function json(/** @type {string} */ url, /** @type {RequestInit} */ init = {}) {
  const res = await call(url, init);
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${url} answered ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Codecov's view of the pull request (its compared commits and their state), and the graph token. */
async function codecovPull(
  /** @type {string} */ owner,
  /** @type {string} */ repo,
  /** @type {number} */ pr,
) {
  const query = `{ owner(username: "${owner}") { repository(name: "${repo}") { ... on Repository { graphToken pull(id: ${pr}) { head { commitid state } comparedTo { commitid state } } } } } }`;
  const body = await json(CODECOV_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const repository = body.data?.owner?.repository;
  return { pull: repository?.pull ?? null, graphToken: repository?.graphToken ?? null };
}

async function totalsAt(
  /** @type {string} */ base,
  /** @type {string} */ sha,
  /** @type {string} */ path,
) {
  const body = await json(`${base}/totals/?sha=${sha}&path=${encodeURIComponent(path)}`);
  return body.totals;
}

async function main() {
  const [prArg, headSha] = process.argv.slice(2);
  const pr = Number(prArg);
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COVERAGE_REPORT_DRY_RUN } = process.env;
  const dryRun = COVERAGE_REPORT_DRY_RUN === '1';
  if (
    !Number.isInteger(pr) ||
    pr <= 0 ||
    !headSha ||
    !GITHUB_REPOSITORY ||
    (!dryRun && !GITHUB_TOKEN)
  ) {
    throw new Error(
      'usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo coverage-report.mjs <pr> <head-sha>',
    );
  }
  const [owner, repo] = GITHUB_REPOSITORY.split('/');
  const repoApi = `${CODECOV_API}/${owner}/repos/${repo}`;

  // Codecov processes the uploads a little after CI ends: wait for this head, with every upload in.
  let pull = null;
  let graphToken = null;
  // A dropped connection is one more attempt that was not ready, up to NETWORK_RETRIES of them.
  let networkFailures = 0;
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    let commit = null;
    try {
      ({ pull, graphToken } = await codecovPull(owner, repo, pr));
      commit = await call(`${repoApi}/commits/${headSha}/`).then((r) => (r.ok ? r.json() : null));
    } catch (error) {
      networkFailures += 1;
      if (networkFailures > NETWORK_RETRIES) throw error;
      console.warn(`[coverage-report] attempt ${attempt}: ${failureReason(error)}; retrying`);
      pull = null;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    const sessions = commit?.totals?.sessions ?? 0;
    const ready =
      pull?.head?.commitid === headSha &&
      commit?.state === 'complete' &&
      sessions >= EXPECTED_SESSIONS &&
      pull.comparedTo?.state === 'complete';
    console.log(
      `[coverage-report] attempt ${attempt}: head ${pull?.head?.commitid?.slice(0, 7) ?? 'none'} ${commit?.state ?? '-'} sessions ${sessions}/${EXPECTED_SESSIONS}, base ${pull?.comparedTo?.commitid?.slice(0, 7) ?? 'none'} ${pull?.comparedTo?.state ?? '-'}`,
    );
    if (ready) break;
    pull = null;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (!pull) throw new Error(`Codecov never finished processing ${headSha} for #${pr}`);
  const baseSha = pull.comparedTo.commitid;

  const summary = await json(`${repoApi}/pulls/${pr}/`);
  const areas = [];
  for (const area of AREAS) {
    const [b, h] = await Promise.all([
      Promise.all(area.paths.map((p) => totalsAt(repoApi, baseSha, p))),
      Promise.all(area.paths.map((p) => totalsAt(repoApi, headSha, p))),
    ]);
    areas.push({ name: area.name, base: sumTotals(b), head: sumTotals(h) });
  }
  const report = renderReport({
    pr,
    baseSha,
    headSha,
    base: summary.base_totals,
    head: summary.head_totals,
    patch: summary.patch ?? null,
    areas,
    codecovUrl: `https://app.codecov.io/gh/${owner}/${repo}/pull/${pr}`,
    graphToken,
  });

  if (dryRun) {
    console.log(`[coverage-report] dry run for #${pr}, nothing written:\n${report}`);
    return;
  }

  const gh = (/** @type {string} */ path, /** @type {RequestInit} */ init = {}) =>
    json(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
    });
  // Editing a description notifies no one, unlike a new comment. Read just before writing, so an
  // edit the author made while Codecov processed is kept.
  const { body } = await gh(`/pulls/${pr}`);
  const next = withReport(body, report);
  if (next === body) {
    console.log(`[coverage-report] #${pr} already shows this report; nothing to write`);
    return;
  }
  await gh(`/pulls/${pr}`, { method: 'PATCH', body: JSON.stringify({ body: next }) });
  console.log(
    `[coverage-report] ${body?.includes(REPORT_START) ? 'updated' : 'added'} the report in the description of #${pr}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[coverage-report] failed: ${failureReason(error)}`);
    process.exit(1);
  });
}
