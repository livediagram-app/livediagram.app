// Posts the pull request's coverage report as one comment: the coverage diff against its base and a
// row per area of the repo (docs/specs/003-system-architecture/testing.md "Coverage report"). The numbers are
// Codecov's, read from its public API; Codecov's own comment is off, because the free plan this
// organisation is on writes a fixed patch-only one whatever codecov.yml asks for.
//
//   node scripts/coverage-comment.mjs <pr-number> <head-sha>
//
// Needs GITHUB_TOKEN (pull-requests: write) and GITHUB_REPOSITORY; COVERAGE_COMMENT_DRY_RUN=1 prints
// the comment instead of posting it, and needs no token. Run by coverage-comment.yml after
// CI succeeds; it never checks out or runs the pull request's code.

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

/** Marks the comment this script owns, so a later run edits it rather than adding another. */
export const MARKER = '<!-- livediagram:coverage-report -->';

const CODECOV_API = 'https://api.codecov.io/api/v2/github';
const CODECOV_GRAPHQL = 'https://api.codecov.io/graphql/gh';
const POLL_INTERVAL_MS = 10_000;
const POLL_ATTEMPTS = 30;

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
 * The whole comment.
 * @param {{ pr: number, baseSha: string, headSha: string, base: Totals, head: Totals,
 *   patch: { hits: number, misses: number, partials: number } | null,
 *   areas: { name: string, base: Totals, head: Totals }[], codecovUrl: string }} report
 */
export function renderComment(report) {
  const { pr, baseSha, headSha, base, head, patch, areas, codecovUrl } = report;
  const baseCov = coverageOf(base);
  const headCov = coverageOf(head);
  const delta = pctDelta(baseCov, headCov);
  const rows = areas.map((a) => {
    const b = coverageOf(a.base);
    const h = coverageOf(a.head);
    return `| ${a.name} | ${pct(b)} | ${pct(h)} | ${pctDelta(b, h)} |`;
  });
  return [
    MARKER,
    `## [Coverage](${codecovUrl}) report`,
    patchLine(patch),
    `:bar_chart: Project coverage is ${pct(headCov)}${delta ? ` (${delta})` : ''}, comparing \`main\` at \`${baseSha.slice(0, 7)}\` with \`${headSha.slice(0, 7)}\`.`,
    '',
    `| Area | \`main\` | #${pr} | +/- |`,
    '| --- | ---: | ---: | ---: |',
    ...rows,
    '',
    coverageDiffBlock(base, head, 'main', `#${pr}`),
  ].join('\n');
}

async function json(/** @type {string} */ url, /** @type {RequestInit} */ init = {}) {
  const res = await fetch(url, init);
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${url} answered ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Codecov's view of the pull request: its compared commits and their processing state. */
async function codecovPull(
  /** @type {string} */ owner,
  /** @type {string} */ repo,
  /** @type {number} */ pr,
) {
  const query = `{ owner(username: "${owner}") { repository(name: "${repo}") { ... on Repository { pull(id: ${pr}) { head { commitid state } comparedTo { commitid state } } } } } }`;
  const body = await json(CODECOV_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return body.data?.owner?.repository?.pull ?? null;
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
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COVERAGE_COMMENT_DRY_RUN } = process.env;
  const dryRun = COVERAGE_COMMENT_DRY_RUN === '1';
  if (
    !Number.isInteger(pr) ||
    pr <= 0 ||
    !headSha ||
    !GITHUB_REPOSITORY ||
    (!dryRun && !GITHUB_TOKEN)
  ) {
    throw new Error(
      'usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo coverage-comment.mjs <pr> <head-sha>',
    );
  }
  const [owner, repo] = GITHUB_REPOSITORY.split('/');
  const repoApi = `${CODECOV_API}/${owner}/repos/${repo}`;

  // Codecov processes the uploads a little after CI ends: wait for this head, with every upload in.
  let pull = null;
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    pull = await codecovPull(owner, repo, pr);
    const commit = await fetch(`${repoApi}/commits/${headSha}/`).then((r) =>
      r.ok ? r.json() : null,
    );
    const sessions = commit?.totals?.sessions ?? 0;
    const ready =
      pull?.head?.commitid === headSha &&
      commit?.state === 'complete' &&
      sessions >= EXPECTED_SESSIONS &&
      pull.comparedTo?.state === 'complete';
    console.log(
      `[coverage-comment] attempt ${attempt}: head ${pull?.head?.commitid?.slice(0, 7) ?? 'none'} ${commit?.state ?? '-'} sessions ${sessions}/${EXPECTED_SESSIONS}, base ${pull?.comparedTo?.commitid?.slice(0, 7) ?? 'none'} ${pull?.comparedTo?.state ?? '-'}`,
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
  const body = renderComment({
    pr,
    baseSha,
    headSha,
    base: summary.base_totals,
    head: summary.head_totals,
    patch: summary.patch ?? null,
    areas,
    codecovUrl: `https://app.codecov.io/gh/${owner}/${repo}/pull/${pr}`,
  });

  if (dryRun) {
    console.log(`[coverage-comment] dry run for #${pr}, nothing posted:\n${body}`);
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
  const comments = await gh(`/issues/${pr}/comments?per_page=100`);
  const mine = comments.find((/** @type {{ body?: string }} */ c) => c.body?.startsWith(MARKER));
  if (mine) {
    await gh(`/issues/comments/${mine.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
    console.log(`[coverage-comment] updated comment ${mine.id} on #${pr}`);
  } else {
    const made = await gh(`/issues/${pr}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    console.log(`[coverage-comment] created comment ${made.id} on #${pr}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[coverage-comment] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
