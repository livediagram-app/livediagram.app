import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { shareState } from './state.mjs';

function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'local-workers-'));
  const shared = path.join(root, 'shared');
  const app = path.join(root, 'app');
  mkdirSync(app);
  return { root, shared, app, own: path.join(app, '.wrangler', 'state') };
}

test('a Worker with no state gets a link to the shared state', () => {
  const { shared, app, own } = setup();
  assert.deepEqual(shareState(app, shared), { outcome: 'linked' });
  assert.equal(readlinkSync(own), shared);
  assert.deepEqual(shareState(app, shared), { outcome: 'kept' });
});

test('a Worker’s own state is copied in, never over the shared state, and its old folder kept', () => {
  const { shared, app, own } = setup();
  mkdirSync(path.join(own, 'v3', 'd1'), { recursive: true });
  writeFileSync(path.join(own, 'v3', 'd1', 'mine.sqlite'), 'mine');
  writeFileSync(path.join(own, 'v3', 'd1', 'both.sqlite'), 'app copy');
  mkdirSync(path.join(shared, 'v3', 'd1'), { recursive: true });
  writeFileSync(path.join(shared, 'v3', 'd1', 'both.sqlite'), 'shared copy');

  const result = shareState(app, shared);
  assert.equal(result.outcome, 'merged');
  assert.equal(readFileSync(path.join(shared, 'v3', 'd1', 'mine.sqlite'), 'utf8'), 'mine');
  assert.equal(readFileSync(path.join(shared, 'v3', 'd1', 'both.sqlite'), 'utf8'), 'shared copy');
  assert.equal(readFileSync(path.join(result.kept, 'v3', 'd1', 'both.sqlite'), 'utf8'), 'app copy');
  assert.equal(readlinkSync(own), shared);
});

test('a link somewhere else is left alone', () => {
  const { root, shared, app, own } = setup();
  mkdirSync(path.dirname(own), { recursive: true });
  symlinkSync(path.join(root, 'elsewhere'), own);
  assert.deepEqual(shareState(app, shared), { outcome: 'foreign' });
  assert.equal(readlinkSync(own), path.join(root, 'elsewhere'));
});
