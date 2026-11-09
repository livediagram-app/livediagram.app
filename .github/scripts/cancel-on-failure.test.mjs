import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runsToCancel, shouldAct } from './cancel-on-failure.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

// A small reader for this repository's workflow files (two-space indent, no flow mappings): each job's
// own permissions and its steps' scalar keys. Enough to hold the fail-fast rules without a YAML package.
function readJobs(text) {
  const lines = text.split('\n');
  const top = { permissions: {}, jobs: {} };
  let section = null;
  let job = null;
  let block = null;
  let step = null;
  for (const line of lines) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    if (indent === 0) {
      section = body.replace(/:.*$/, '');
      job = null;
      continue;
    }
    if (section === 'permissions' && indent === 2) {
      const [key, value] = body.split(/:\s*/);
      top.permissions[key] = value;
      continue;
    }
    if (section !== 'jobs') continue;
    if (indent === 2) {
      job = { name: body.replace(/:$/, ''), permissions: null, steps: null, keys: {} };
      top.jobs[job.name] = job;
      block = null;
      continue;
    }
    if (!job) continue;
    if (indent === 4) {
      const [key, ...rest] = body.split(':');
      const value = rest.join(':').trim();
      job.keys[key] = value;
      block = key;
      if (key === 'permissions') job.permissions = {};
      if (key === 'steps') job.steps = [];
      continue;
    }
    if (block === 'permissions' && indent === 6) {
      const [key, value] = body.split(/:\s*/);
      job.permissions[key] = value;
    } else if (block === 'steps' && indent === 6 && body.startsWith('- ')) {
      step = {};
      job.steps.push(step);
      const [key, ...rest] = body.slice(2).split(':');
      step[key] = rest.join(':').trim();
    } else if (block === 'steps' && indent === 8 && step) {
      const [key, ...rest] = body.split(':');
      step[key] = rest.join(':').trim();
    }
  }
  return top;
}

const ACTION = './.github/actions/cancel-on-failure';
const GUARD = "failure() && github.event_name == 'pull_request'";
// Jobs without the step: the gates (they fail only after a job that already failed fast, and check out
// nothing) and the coverage report, which informs and never gates (continue-on-error), so its failure
// must not cancel anything.
const EXEMPT = new Set(['ci', 'e2e', 'coverage-report']);

const workflows = {
  'ci.yml': readJobs(read('workflows/ci.yml')),
  'e2e.yml': readJobs(read('workflows/e2e.yml')),
  'e2e-product.yml': readJobs(read('workflows/e2e-product.yml')),
};

test('every CI and E2E job with steps ends with the fail-fast step, guarded to pull requests', () => {
  let checked = 0;
  for (const [file, { jobs }] of Object.entries(workflows)) {
    for (const job of Object.values(jobs)) {
      if (!job.steps || EXEMPT.has(job.name)) continue;
      const last = job.steps.at(-1);
      assert.equal(last.uses, ACTION, `${file} ${job.name}: last step is not the fail-fast step`);
      assert.equal(last.if, GUARD, `${file} ${job.name}: fail-fast step is not guarded`);
      const others = job.steps.slice(0, -1).filter((step) => step.uses === ACTION);
      assert.equal(others.length, 0, `${file} ${job.name}: fail-fast step is not the last`);
      checked++;
    }
  }
  // plan, checks, tests, editor tests, editor coverage floors and build; E2E's plan; the four per-product jobs.
  assert.equal(checked, 11);
});

test('the exempt jobs are what the list says they are', () => {
  assert.equal(workflows['ci.yml'].jobs['coverage-report'].keys['continue-on-error'], 'true');
  assert.equal(workflows['ci.yml'].jobs.ci.keys.if, 'always()');
  assert.equal(workflows['e2e.yml'].jobs.e2e.keys.if, 'always()');
});

test('every job that fails fast may cancel runs (actions: write)', () => {
  for (const [file, { permissions, jobs }] of Object.entries(workflows)) {
    for (const job of Object.values(jobs)) {
      const runsStep = job.steps?.some((step) => step.uses === ACTION);
      const callsProduct = job.keys.uses === './.github/workflows/e2e-product.yml';
      if (!runsStep && !callsProduct) continue;
      const granted = job.permissions ?? permissions;
      assert.equal(granted.actions, 'write', `${file} ${job.name}: no actions: write`);
    }
  }
  // A called workflow's own grant, capped by its callers' above.
  assert.equal(workflows['e2e-product.yml'].permissions.actions, 'write');
});

test('the action itself runs on pull requests only', () => {
  const action = read('actions/cancel-on-failure/action.yml');
  assert.match(action, /\n {6}if: github\.event_name == 'pull_request'\n/);
  // Its step never fails the job further.
  assert.match(action, /cancel-on-failure\.mjs" \|\| true\n/);
});

test('the script acts on pull requests only, never on a push, a run by hand or a deploy', () => {
  assert.equal(shouldAct('pull_request'), true);
  for (const event of [
    'push',
    'workflow_dispatch',
    'workflow_run',
    'schedule',
    'pull_request_target',
    '',
  ]) {
    assert.equal(shouldAct(event), false, event);
  }
});

const run = (id, extra = {}) => ({
  id,
  event: 'pull_request',
  head_sha: 'abc',
  status: 'in_progress',
  ...extra,
});

test("cancels the commit's unfinished pull request runs, never its own", () => {
  const runs = [
    run(1),
    run(2, { status: 'queued' }),
    run(3, { status: 'completed' }),
    run(4, { head_sha: 'older' }),
    run(5, { event: 'push' }),
    run(9),
  ];
  // Cancelling its own run would record the failing job as cancelled (the probe on #1356).
  assert.deepEqual(runsToCancel(runs, { headSha: 'abc', ownRunId: '9' }), [1, 2]);
});

test('with nothing else running, nothing is cancelled', () => {
  assert.deepEqual(runsToCancel([run(9)], { headSha: 'abc', ownRunId: '9' }), []);
  assert.deepEqual(runsToCancel([], { headSha: 'abc', ownRunId: '' }), []);
});
