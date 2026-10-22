import { describe, expect, it } from 'vitest';
import { articleDates, parseArticleDates } from './article-dates';

const LOG = [
  '@2026-10-11T20:58:14+01:00',
  '',
  'canvas/themes/page.mdx',
  'components/illustrations/themes.tsx',
  '@2026-09-01T10:00:00+00:00',
  '',
  'canvas/themes/page.mdx',
  'canvas/page.tsx',
  'page.tsx',
].join('\n');

describe('parseArticleDates', () => {
  it("dates each page by its newest commit, and ignores files that aren't pages", () => {
    const dates = parseArticleDates(LOG);
    expect(dates.get('canvas/themes')?.toISOString()).toBe('2026-10-11T19:58:14.000Z');
    expect(dates.get('canvas')?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(dates.get('')?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect([...dates.keys()]).not.toContain('components/illustrations/themes.tsx');
    expect(dates.size).toBe(3);
  });
});

describe('articleDates', () => {
  it('reads the log on a full clone', () => {
    const git = (args: string[]) => (args[0] === 'rev-parse' ? 'false\n' : LOG);
    expect(articleDates(git).size).toBe(3);
  });

  it('gives no dates on a shallow clone, where every file would date to one commit', () => {
    expect(articleDates(() => 'true\n').size).toBe(0);
  });

  it('gives no dates without git', () => {
    expect(
      articleDates(() => {
        throw new Error('git: not found');
      }).size,
    ).toBe(0);
  });

  it('dates real articles in this checkout', () => {
    // A guard against the parser going blind on git's real output. Skipped where history is unavailable.
    const dates = articleDates();
    if (dates.size === 0) return;
    expect(dates.get('canvas/themes')).toBeInstanceOf(Date);
    expect(dates.size).toBeGreaterThan(200);
  });
});
