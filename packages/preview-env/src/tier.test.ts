import { describe, expect, it } from 'vitest';

import { FULL_PREVIEW_LABEL } from './names.ts';
import { API_PACKAGE, decideTier, parseTurboLs } from './tier.ts';

describe('decideTier', () => {
  it.each([
    [true, false, { tier: 'full', addLabel: true, reason: 'graph' }],
    [true, true, { tier: 'full', addLabel: false, reason: 'graph' }],
    [false, true, { tier: 'full', addLabel: false, reason: 'label' }],
    [false, false, { tier: 'preview', addLabel: false, reason: 'none' }],
  ])('api affected %s, labelled %s', (graph, labelled, expected) => {
    expect(
      decideTier({
        affected: graph ? ['@livediagram/document', API_PACKAGE] : ['@livediagram/live'],
        labels: labelled ? ['bug', FULL_PREVIEW_LABEL] : ['bug'],
      }),
    ).toEqual(expected);
  });
});

describe('parseTurboLs', () => {
  it('reads package names from turbo ls --output=json', () => {
    const json = JSON.stringify({
      packageManager: 'pnpm',
      packages: {
        count: 2,
        items: [
          { name: '@livediagram/api', path: 'apps/api' },
          { name: '@livediagram/document', path: 'packages/document' },
        ],
      },
    });
    expect(parseTurboLs(json)).toEqual(['@livediagram/api', '@livediagram/document']);
  });

  it.each([
    'not json',
    'null',
    '{}',
    '{"packages":{"items":[{}]}}',
    '{"packages":{"items":[null]}}',
  ])('rejects %s as bad-turbo', (json) => {
    expect(() => parseTurboLs(json)).toThrow(/^bad-turbo:/);
  });
});
