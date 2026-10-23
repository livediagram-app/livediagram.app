import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The comparison pages moved to liveworkspace.app (liveworkspace/docs/comparison-pages.md). Every
// /alternatives address here, the hub and each comparison, redirects there permanently from
// public/_redirects, so old links and search results keep landing on the same comparison.
const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));

describe('the comparison pages', () => {
  it('send the hub, with and without a trailing slash, to liveworkspace.app', () => {
    for (const from of ['/alternatives', '/alternatives/']) {
      expect(rules.find(([source]) => source === from)).toEqual([
        from,
        'https://liveworkspace.app/alternatives',
        '301',
      ]);
    }
  });

  it('send every comparison to the one of the same name there', () => {
    expect(rules.find(([source]) => source === '/alternatives/*')).toEqual([
      '/alternatives/*',
      'https://liveworkspace.app/alternatives/:splat',
      '301',
    ]);
  });

  it('leave no rule that would catch a comparison first', () => {
    const first = rules.findIndex(([source]) => source!.startsWith('/alternatives'));
    expect(rules.slice(first).every(([source]) => source!.startsWith('/alternatives'))).toBe(true);
  });
});
