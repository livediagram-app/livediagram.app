// The nightly canvas performance run's I/O (docs/specs/008-canvas/canvas-performance.md "Measuring";
// .github/workflows/canvas-perf.yml). Dependency-free; the decisions live in budget-report.ts, which
// Node runs as is (type-only TypeScript).
//
//   node e2e/perf/nightly.mjs previous   the commit the last successful run measured, or nothing
//   node e2e/perf/nightly.mjs report     job summary, then open / comment on / close the issue
//
// Reads GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_RUN_ID,
// GITHUB_STEP_SUMMARY, GITHUB_API_URL (Actions sets it) and, for report, PREVIOUS_SHA.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { BUDGET_ISSUE_TITLE, budgetIssueAction, budgetIssueComment } from './budget-report.ts';

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`[canvas-perf] missing ${name}`);
  return value;
};

async function api(path, init = {}) {
  const base = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const res = await fetch(`${base}/repos/${env('GITHUB_REPOSITORY')}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok)
    throw new Error(
      `[canvas-perf] ${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`,
    );
  return res.status === 204 ? null : res.json();
}

async function previous() {
  const runs = await api(
    '/actions/workflows/canvas-perf.yml/runs?branch=main&status=success&per_page=1',
  );
  process.stdout.write(runs.workflow_runs[0]?.head_sha ?? '');
}

async function report() {
  const rows = JSON.parse(readFileSync('test-results/perf/canvas-perf.json', 'utf8'));
  const table = readFileSync('test-results/perf/canvas-perf.md', 'utf8').trim();
  const misses = rows.filter((r) => !r.pass).length;
  const sha = env('GITHUB_SHA').slice(0, 9);
  const runUrl = `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`;
  appendFileSync(
    env('GITHUB_STEP_SUMMARY'),
    `## Canvas performance budget\n\n${misses} of ${rows.length} rows over budget at ${sha}.\n\n${table}\n`,
  );

  const prev = process.env.PREVIOUS_SHA;
  const commits = prev
    ? execFileSync('git', ['log', '--oneline', `${prev}..${env('GITHUB_SHA')}`], {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
    : [];
  const open = (await api('/issues?state=open&per_page=100')).find(
    (i) => i.title === BUDGET_ISSUE_TITLE && !i.pull_request,
  );
  const onMain = env('GITHUB_REF') === 'refs/heads/main';
  const action = budgetIssueAction({ misses, issueOpen: Boolean(open), onMain });
  const body = budgetIssueComment({
    action,
    table,
    misses,
    rows: rows.length,
    sha,
    commits,
    runUrl,
  });
  console.log(
    `[canvas-perf] ${misses} of ${rows.length} over budget on ${env('GITHUB_REF')}; issue: ${action}`,
  );
  if (action === 'open') {
    await api('/issues', {
      method: 'POST',
      body: JSON.stringify({ title: BUDGET_ISSUE_TITLE, body }),
    });
  } else if (action === 'comment' || action === 'close') {
    await api(`/issues/${open.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    if (action === 'close') {
      await api(`/issues/${open.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
    }
  }
}

const command = process.argv[2];
if (command === 'previous') await previous();
else if (command === 'report') await report();
else throw new Error(`[canvas-perf] unknown command ${command}`);
