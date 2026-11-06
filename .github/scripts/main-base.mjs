// The base commit a push to main is planned against (docs/ci.md "Runs on main"): the newest commit
// this workflow last passed on main, not the commit just before. A newer push cancels main's older
// run, so the commits in between were never checked there; diffing from the last green commit takes
// them in. With no green ancestor (a first run, a force-push, an API failure) the base is empty and
// everything runs.
//
//   WORKFLOW=ci.yml HEAD=<sha> node .github/scripts/main-base.mjs   -> writes base=<sha or empty>

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The newest green run's commit that is an ancestor of HEAD. HEAD itself is skipped, so re-running a
// green commit checks its own change again rather than nothing.
export function pickBase(greenShas, head, isAncestor) {
  for (const sha of greenShas) {
    if (sha !== head && isAncestor(sha, head)) return sha;
  }
  return '';
}

function isAncestor(sha, head) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, head], { stdio: 'ignore' });
    return true;
  } catch {
    // Not an ancestor, or a commit this checkout doesn't have (force-pushed away).
    return false;
  }
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    WORKFLOW: workflow,
    HEAD: head,
  } = process.env;
  let base = '';
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?branch=main&event=push&status=success&per_page=30`,
      { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } },
    );
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const { workflow_runs: runs } = await response.json();
    base = pickBase(
      runs.map((run) => run.head_sha),
      head,
      isAncestor,
    );
  } catch (error) {
    console.error(`[main-base] listing ${workflow} runs failed, so everything runs: ${error}`);
  }
  console.log(`[main-base] ${workflow} at ${head}: base ${base || 'none (everything)'}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `base=${base}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
