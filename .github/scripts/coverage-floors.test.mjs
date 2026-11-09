// node --test .github/scripts  (run by CI's platform Checks)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FLOORS_FILE,
  RAISE_HINT,
  floorOf,
  judge,
  measure,
  parseShard,
  raise,
  shardsByEditor,
} from './coverage-floors.mjs';
import { coverageIn, mergeLcov } from './lcov.mjs';

const SCRIPT = fileURLToPath(new URL('./coverage-floors.mjs', import.meta.url));

const lcov = (/** @type {string} */ file, /** @type {string[]} */ rows) =>
  [`SF:${file}`, ...rows, 'end_of_record'].join('\n');

/** A folder of artifact folders, each holding one lcov.info. */
function artifacts(/** @type {Record<string, string>} */ byName) {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-floors-'));
  for (const [name, text] of Object.entries(byName)) {
    mkdirSync(path.join(root, name, 'coverage'), { recursive: true });
    writeFileSync(path.join(root, name, 'coverage', 'lcov.info'), text);
  }
  return root;
}

test('names: an editor shard, nothing else', () => {
  assert.deepEqual(parseShard('coverage-livehuddle-editor-3'), { group: 'livehuddle', shard: 3 });
  assert.equal(parseShard('coverage-livediagram-tests'), null);
  assert.equal(parseShard('coverage-livediagram-editor-x'), null);
});

test('measure: a line is covered when any shard ran it, a branch when any shard took it', () => {
  const coverage = new Map();
  // Shard 1 runs line 1 and takes one branch; shard 2 runs line 2. Line 3 runs nowhere.
  mergeLcov(lcov('a.ts', ['DA:1,1', 'DA:2,0', 'DA:3,0', 'BRDA:1,0,0,1', 'BRDA:1,0,1,0']), coverage);
  mergeLcov(lcov('a.ts', ['DA:1,0', 'DA:2,4', 'DA:3,0', 'BRDA:1,0,0,0', 'BRDA:1,0,1,-']), coverage);
  const m = measure(coverage);
  assert.equal(m.lines, (2 / 3) * 100);
  assert.equal(m.branches, 50);
  assert.deepEqual(measure(new Map()), { lines: 0, branches: null });
});

test('floors round down to one decimal, never up past what was measured', () => {
  assert.equal(floorOf(78.69), 78.6);
  assert.equal(floorOf(78.6), 78.6);
  assert.equal(floorOf(80), 80);
  assert.equal(floorOf((2 / 3) * 100), 66.6);
});

test('judge: below a floor fails, at it passes, well above it only notes', () => {
  const floors = { a: { lines: 70, branches: 60 }, b: { lines: 70 } };
  const below = judge(new Map([['a', { lines: 69.99, branches: 60 }]]), floors);
  assert.equal(below.failures.length, 1);
  assert.match(below.failures[0], /a: lines coverage 69\.99% is below its floor of 70%/);

  const at = judge(new Map([['a', { lines: 70, branches: 60.4 }]]), floors);
  assert.deepEqual([at.failures, at.notes], [[], []]);

  const above = judge(new Map([['a', { lines: 70 + RAISE_HINT, branches: 59 }]]), floors);
  assert.equal(above.failures.length, 1, 'branches below their floor still fail');
  assert.match(above.failures[0], /branches/);
  assert.equal(above.notes.length, 1);
  assert.match(above.notes[0], /a: lines coverage 70\.50% beats its floor of 70% by 0\.50 points/);

  // A floor without branches checks lines alone.
  assert.deepEqual(judge(new Map([['b', { lines: 71, branches: 1 }]]), floors).failures, []);
});

test('judge: an editor without a floor fails, so a new editor gets one', () => {
  const { failures } = judge(new Map([['new', { lines: 90, branches: 80 }]]), {});
  assert.equal(failures.length, 1);
  assert.match(failures[0], /new: no floor/);
});

test('raise: floors only rise, and an editor without one gets one', () => {
  const floors = { a: { lines: 70, branches: 60 }, b: { lines: 50, branches: 40 } };
  const measured = new Map([
    ['a', { lines: 72.38, branches: 55 }],
    ['b', { lines: 49, branches: null }],
    ['c', { lines: 10.05, branches: 5.99 }],
  ]);
  assert.deepEqual(raise(floors, measured), {
    a: { lines: 72.3, branches: 60 },
    b: { lines: 50, branches: 40 },
    c: { lines: 10, branches: 5.9 },
  });
  assert.deepEqual(floors.a, { lines: 70, branches: 60 }, 'the input is left alone');
});

test('shards: every shard the plan reached must be there; other editors are left out', () => {
  const names = ['coverage-a-editor-1', 'coverage-a-editor-3', 'coverage-b-editor-1', 'other'];
  const loose = shardsByEditor(names, null);
  assert.deepEqual([...loose.found.keys()], ['a', 'b']);
  assert.deepEqual(loose.missing, []);

  const plan = [1, 2, 3].map((shard) => ({ group: 'a', shard, total: 3 }));
  const strict = shardsByEditor(names, plan);
  assert.deepEqual([...strict.found.keys()], ['a']);
  assert.deepEqual(strict.missing, ['coverage-a-editor-2']);
});

test('the committed floors name the five editors, each a number with one decimal at most', () => {
  const floors = JSON.parse(readFileSync(FLOORS_FILE, 'utf8'));
  assert.deepEqual(Object.keys(floors).sort(), [
    'livedesign',
    'livediagram',
    'livedocuments',
    'livehuddle',
    'liveplanner',
  ]);
  for (const f of Object.values(floors))
    for (const v of [f.lines, f.branches]) {
      assert.equal(typeof v, 'number');
      assert.equal(floorOf(v), v);
    }
});

test('the script: exit 1 below a floor or on a missing shard, 0 at it', () => {
  const run = (/** @type {string} */ dir, /** @type {Record<string, string>} */ env = {}) => {
    try {
      execFileSync('node', [SCRIPT, dir], {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '', EDITORS: '', ...env },
      });
      return 0;
    } catch (e) {
      return /** @type {{ status: number }} */ (e).status;
    }
  };
  const floors = JSON.parse(readFileSync(FLOORS_FILE, 'utf8'));
  const { lines, branches } = floors.livediagram;
  // 1,000 lines and 1,000 branches, so coverage lands on the floor exactly or a tenth below it.
  const report = (/** @type {number} */ linePct, /** @type {number} */ branchPct) => {
    const rows = [];
    for (let i = 1; i <= 1000; i++) rows.push(`DA:${i},${i <= linePct * 10 ? 1 : 0}`);
    for (let i = 1; i <= 1000; i++) rows.push(`BRDA:1,0,${i},${i <= branchPct * 10 ? 1 : 0}`);
    return lcov('livediagram/apps/editor/a.ts', rows);
  };
  const shards = (/** @type {string} */ text) => ({
    'coverage-livediagram-editor-1': text,
    'coverage-livediagram-editor-2': lcov('livediagram/apps/editor/a.ts', ['DA:1,0']),
    'coverage-livediagram-editor-3': lcov('livediagram/apps/editor/a.ts', ['DA:1,0']),
  });
  assert.equal(run(artifacts(shards(report(lines, branches)))), 0);
  assert.equal(run(artifacts(shards(report(lines - 0.1, branches)))), 1);
  assert.equal(run(artifacts(shards(report(lines, branches - 0.1)))), 1);

  const plan = JSON.stringify(
    [1, 2, 3, 4].map((shard) => ({ group: 'livediagram', shard, total: 4 })),
  );
  assert.equal(run(artifacts(shards(report(lines, branches))), { EDITORS: plan }), 1);
  assert.equal(run(artifacts({})), 0, 'a run that reached no editor has nothing to check');
});

test('the shared reader merges every lcov.info under each folder', () => {
  const dir = artifacts({
    one: lcov('a.ts', ['DA:1,1', 'DA:2,0']),
    two: lcov('a.ts', ['DA:2,1']),
  });
  const coverage = coverageIn([path.join(dir, 'one'), path.join(dir, 'two')]);
  assert.equal(measure(coverage).lines, 100);
});
