import { describe, expect, it } from 'vitest';

import { parsePrNumber } from './names.ts';
import { NOT_FOUND_CODES, isNotFound, parseScope, teardownPlan } from './teardown.ts';

const pr = parsePrNumber(42);

describe('teardownPlan', () => {
  it('all: router first, community before api, then the bucket and the database', () => {
    expect(teardownPlan(pr, 'all')).toEqual([
      { kind: 'worker', name: 'livediagram-router-pr-42' },
      { kind: 'worker', name: 'livediagram-community-pr-42' },
      { kind: 'worker', name: 'livediagram-marketing-pr-42' },
      { kind: 'worker', name: 'livediagram-live-pr-42' },
      { kind: 'worker', name: 'livediagram-telemetry-pr-42' },
      { kind: 'worker', name: 'livediagram-help-pr-42' },
      { kind: 'worker', name: 'livediagram-api-pr-42' },
      { kind: 'r2', name: 'livediagram-images-pr-42' },
      { kind: 'd1', name: 'livediagram-pr-42' },
    ]);
  });

  it('full: only what a Full preview adds', () => {
    expect(teardownPlan(pr, 'full')).toEqual([
      { kind: 'worker', name: 'livediagram-api-pr-42' },
      { kind: 'r2', name: 'livediagram-images-pr-42' },
      { kind: 'd1', name: 'livediagram-pr-42' },
    ]);
  });

  it('parseScope accepts exactly the two scopes', () => {
    expect(parseScope('all')).toBe('all');
    expect(parseScope('full')).toBe('full');
    expect(() => parseScope('api')).toThrow(/unknown teardown scope/);
  });
});

describe('isNotFound', () => {
  it('a 404 is gone', () => {
    expect(isNotFound({ status: 404 })).toBe(true);
  });

  it.each(NOT_FOUND_CODES)('code %i is gone', (code) => {
    expect(isNotFound({ status: 400, errors: [{ code }] })).toBe(true);
  });

  it.each([
    { status: 403, errors: [{ code: 10000 }] },
    { status: 500 },
    { status: 409, errors: [{ code: 10013 }] },
  ])('%j is a real failure', (outcome) => {
    expect(isNotFound(outcome)).toBe(false);
  });
});
