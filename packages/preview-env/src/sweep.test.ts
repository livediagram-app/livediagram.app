import { expect, it } from 'vitest';

import { sweepTargets } from './sweep.ts';

const names = [
  'livediagram-router',
  'livediagram-router-staging',
  'livediagram-router-pr-3',
  'livediagram-api-pr-3',
  'livediagram-pr-3',
  'livediagram-router-pr-5',
  'livediagram-images-pr-9',
  'livediagram-mcp-pr-11',
];

it('targets each closed PR once, in order, and only preview names', () => {
  expect(sweepTargets(names, [5])).toEqual([3, 9]);
});

it('targets nothing when every owner is open', () => {
  expect(sweepTargets(names, [3, 5, 9])).toEqual([]);
});
