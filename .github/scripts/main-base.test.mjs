import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBase } from './main-base.mjs';

// a <- b <- c <- d on main; x was force-pushed away.
const history = ['a', 'b', 'c', 'd'];
const isAncestor = (sha, head) =>
  history.includes(sha) && history.indexOf(sha) <= history.indexOf(head);

test('a cancelled run in between is covered: the base is the last green commit, not the one before', () => {
  // c's run was cancelled by d's, so d plans against b and takes in c's change.
  assert.equal(pickBase(['b', 'a'], 'd', isAncestor), 'b');
});

test('a commit that is not an ancestor is passed over', () => {
  assert.equal(pickBase(['x', 'b'], 'd', isAncestor), 'b');
});

test('re-running a green commit checks its own change, not nothing', () => {
  assert.equal(pickBase(['d', 'c'], 'd', isAncestor), 'c');
});

test('with no green ancestor the base is empty, so everything runs', () => {
  assert.equal(pickBase([], 'd', isAncestor), '');
  assert.equal(pickBase(['x'], 'd', isAncestor), '');
});
