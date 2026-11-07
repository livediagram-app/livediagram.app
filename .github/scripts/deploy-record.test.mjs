import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, newestSuccessful } from './deploy-record.mjs';

// A fake GitHub API: `routes` maps "METHOD path" to a JSON body, or to a status number.
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = url.replace('https://api.github.com/repos/o/r/', '');
    const key = `${init.method} ${path}`;
    calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined });
    const hit = routes[key];
    if (hit === undefined) return new Response('not found', { status: 404 });
    if (typeof hit === 'number') return new Response('nope', { status: hit });
    return new Response(JSON.stringify(hit), { status: 200 });
  };
  return { fetchImpl, calls };
}

function run(argv, routes) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-record-'));
  const env = {
    GITHUB_TOKEN: 't',
    GITHUB_REPOSITORY: 'o/r',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_RUN_ID: '7',
    GITHUB_OUTPUT: join(dir, 'out'),
    GITHUB_STEP_SUMMARY: join(dir, 'summary'),
  };
  const read = (name) => {
    try {
      return readFileSync(join(dir, name), 'utf8');
    } catch {
      return '';
    }
  };
  const { fetchImpl, calls } = fakeFetch(routes);
  return main(argv, env, fetchImpl).then((code) => ({
    code,
    calls,
    output: read('out'),
    summary: read('summary'),
  }));
}

const LIST = 'GET deployments?environment=production&task=record&per_page=10';
const TAG = 'GET git/ref/tags/deployed/production';

test('the newest record with a success status wins, even when a later one marked it inactive', async () => {
  const statuses = { 1: [{ state: 'pending' }], 2: [{ state: 'inactive' }, { state: 'success' }] };
  const sha = await newestSuccessful(
    [
      { id: 1, sha: 'a' },
      { id: 2, sha: 'b' },
    ],
    async (id) => statuses[id],
  );
  assert.equal(sha, 'b');
});

test('read takes the record, not the tag', async () => {
  const { code, output, calls } = await run(['read', 'production'], {
    [LIST]: [{ id: 5, sha: 'rec' }],
    'GET deployments/5/statuses?per_page=100': [{ state: 'success' }],
    [TAG]: { object: { type: 'commit', sha: 'old' } },
  });
  assert.equal(code, 0);
  assert.equal(output, 'sha=rec\n');
  assert.ok(!calls.some((call) => call.key === TAG));
});

test('with no record yet, read falls back to the old tag, so the first deploy after the switch plans right', async () => {
  const { output } = await run(['read', 'production'], {
    [LIST]: [],
    [TAG]: { object: { type: 'commit', sha: 'old' } },
  });
  assert.equal(output, 'sha=old\n');
});

test('an annotated tag is peeled to its commit', async () => {
  const { output } = await run(['read', 'production'], {
    [LIST]: [],
    [TAG]: { object: { type: 'tag', sha: 'tagobj' } },
    'GET git/tags/tagobj': { object: { type: 'commit', sha: 'peeled' } },
  });
  assert.equal(output, 'sha=peeled\n');
});

test('with neither, read is empty, so every Worker deploys', async () => {
  const { output } = await run(['read', 'production'], { [LIST]: [] });
  assert.equal(output, 'sha=\n');
});

test('read fails on an API error rather than planning from nothing', async () => {
  await assert.rejects(run(['read', 'production'], { [LIST]: 502 }), /502/);
});

test('write records the commit as a deployment of it, then marks it a success', async () => {
  const { code, calls, summary } = await run(['write', 'production', 'abc'], {
    'POST deployments': { id: 9 },
    'POST deployments/9/statuses': { id: 1 },
  });
  assert.equal(code, 0);
  assert.deepEqual(calls[0].body, {
    ref: 'abc',
    task: 'record',
    environment: 'production',
    auto_merge: false,
    required_contexts: [],
    production_environment: true,
    description: 'production runs abc',
  });
  assert.equal(calls[1].body.state, 'success');
  assert.equal(calls[1].body.log_url, 'https://github.com/o/r/actions/runs/7');
  assert.equal(summary, 'production runs `abc`.\n');
});

test('a failed write warns and leaves the run green: the Workers have deployed', async (t) => {
  const logged = [];
  t.mock.method(console, 'log', (line) => logged.push(line));
  const { code, summary } = await run(['write', 'staging', 'abc'], { 'POST deployments': 403 });
  assert.equal(code, 0);
  assert.match(
    logged.join('\n'),
    /^::warning::Every Worker deployed, but recording staging at abc failed/,
  );
  assert.match(summary, /the record failed/);
});

test('a bad command is a usage error', async () => {
  const { code } = await run(['move', 'production'], {});
  assert.equal(code, 2);
});
