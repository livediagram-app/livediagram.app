// Fail fast on a pull request (docs/ci.md "Fail fast"): the last step of every CI and E2E job runs this
// when the job has failed, and cancels the pull request commit's other CI and E2E work still going,
// since the commit is already red. It runs on the runner that just failed, so it starts at once rather
// than queueing for a runner of its own.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo GITHUB_EVENT_NAME=pull_request GITHUB_RUN_ID=…
//   HEAD_SHA=<pull request head> WORKFLOWS="ci.yml e2e.yml" CANCEL_OWN_RUN=true
//   node .github/scripts/cancel-on-failure.mjs
//
// It never fails the job further and never acts on anything but a pull request: a push to main, a run
// by hand and the deploys always run to the end.

import { pathToFileURL } from 'node:url';

// A run still holding or waiting for runners.
const UNFINISHED = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

export function shouldAct(eventName) {
  return eventName === 'pull_request';
}

// The runs to cancel, from the listed runs of the watched workflows: only a pull request's runs of this
// head commit that are not finished. This run comes last (cancelling it may stop this step), and only
// when cancelOwnRun is set.
export function runsToCancel(runs, { headSha, ownRunId, cancelOwnRun }) {
  const own = String(ownRunId);
  const pick = runs.filter(
    (run) => run.event === 'pull_request' && run.head_sha === headSha && UNFINISHED.has(run.status),
  );
  const others = pick.filter((run) => String(run.id) !== own).map((run) => run.id);
  const ids = [...new Set(others)];
  if (cancelOwnRun && own) ids.push(Number(own));
  return ids;
}

async function api(token, path, method = 'GET') {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 || response.status === 202 ? null : response.json();
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    GITHUB_EVENT_NAME: eventName,
    GITHUB_RUN_ID: ownRunId,
    HEAD_SHA: headSha,
    WORKFLOWS: workflows = 'ci.yml e2e.yml',
    CANCEL_OWN_RUN: cancelOwnRun = 'false',
  } = process.env;
  if (!shouldAct(eventName)) {
    console.log(`[cancel-on-failure] a ${eventName} run: nothing is cancelled`);
    return;
  }
  if (!headSha) {
    console.log('[cancel-on-failure] no head commit: nothing is cancelled');
    return;
  }
  const runs = [];
  for (const workflow of workflows.split(/\s+/).filter(Boolean)) {
    try {
      const { workflow_runs: listed } = await api(
        token,
        `/repos/${repo}/actions/workflows/${workflow}/runs?head_sha=${headSha}&event=pull_request&per_page=50`,
      );
      runs.push(...listed);
    } catch (error) {
      console.log(`[cancel-on-failure] listing ${workflow} runs failed: ${error}`);
    }
  }
  const ids = runsToCancel(runs, { headSha, ownRunId, cancelOwnRun: cancelOwnRun === 'true' });
  if (ids.length === 0) console.log('[cancel-on-failure] nothing left to cancel');
  for (const id of ids) {
    const name = runs.find((run) => run.id === id)?.name ?? 'this run';
    try {
      await api(token, `/repos/${repo}/actions/runs/${id}/cancel`, 'POST');
      console.log(`[cancel-on-failure] cancelled ${name} (run ${id})`);
    } catch (error) {
      // A fork's read-only token, or a run that finished meanwhile: the job is red either way.
      console.log(`[cancel-on-failure] cancelling run ${id} failed: ${error}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
