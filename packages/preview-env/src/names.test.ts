import { describe, expect, it } from 'vitest';

import { PreviewError } from './errors.ts';
import {
  MAX_PR_NUMBER,
  d1Name,
  ownerOf,
  parsePrNumber,
  previewHost,
  previewOrigin,
  r2Name,
  stagingWorkerName,
  workerName,
} from './names.ts';

const pr = parsePrNumber(123);

describe('parsePrNumber', () => {
  it('accepts positive integers and their decimal strings', () => {
    expect(parsePrNumber(1)).toBe(1);
    expect(parsePrNumber('123')).toBe(123);
    expect(parsePrNumber(MAX_PR_NUMBER)).toBe(MAX_PR_NUMBER);
  });

  it.each([0, -1, 1.5, '12a', '', '1e3', MAX_PR_NUMBER + 1, null, undefined, {}])(
    'rejects %j as bad-pr',
    (value) => {
      expect(() => parsePrNumber(value)).toThrow(PreviewError);
      expect(() => parsePrNumber(value)).toThrow(/^bad-pr:/);
    },
  );
});

describe('names', () => {
  it('derives every name from the PR number', () => {
    expect(workerName('router', pr)).toBe('livediagram-router-pr-123');
    expect(stagingWorkerName('api')).toBe('livediagram-api-staging');
    expect(d1Name(pr)).toBe('livediagram-pr-123');
    expect(r2Name(pr)).toBe('livediagram-images-pr-123');
    expect(previewHost(pr)).toBe('pr-123.livediagram.app');
    expect(previewOrigin(pr)).toBe('https://pr-123.livediagram.app');
  });

  it('keeps the longest worker name under the 63-character limit', () => {
    expect(workerName('telemetry', parsePrNumber(MAX_PR_NUMBER)).length).toBeLessThan(63);
  });
});

describe('ownerOf', () => {
  it('finds the PR behind each kind of preview resource', () => {
    expect(ownerOf('livediagram-community-pr-7')).toBe(7);
    expect(ownerOf('livediagram-pr-7')).toBe(7);
    expect(ownerOf('livediagram-images-pr-7')).toBe(7);
  });

  it.each([
    // production
    'livediagram-router',
    'livediagram-api',
    'livediagram',
    'livediagram-images',
    // staging
    'livediagram-router-staging',
    'livediagram-api-staging',
    'livediagram-staging',
    'livediagram-images-staging',
    // never a preview
    'livediagram-mcp-pr-7',
    'livediagram-router-pr-0',
    'livediagram-router-pr-7-old',
    'other-pr-7',
  ])('never claims %s', (name) => {
    expect(ownerOf(name)).toBeNull();
  });
});
