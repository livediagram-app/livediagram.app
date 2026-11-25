import { describe, expect, it } from 'vitest';
import {
  ARTICLE_BAND_MAX,
  articleBandsFor,
  bandDate,
  fillBand,
  parseArticleBand,
} from './article-bands';
import { parseArticleStyle } from './article-flow';

// livedocuments/docs/specs/007-editor/article-pages.md "Headers and footers".
describe('reading a header or footer', () => {
  it('keeps each part as one line, capped, and drops empty parts and bands', () => {
    expect(parseArticleBand({ left: 'a\tb\nc', center: '  ', right: 4 })).toEqual({
      left: 'a b c',
    });
    expect(parseArticleBand({ right: 'x'.repeat(ARTICLE_BAND_MAX + 9) })!.right).toHaveLength(
      ARTICLE_BAND_MAX,
    );
    expect(parseArticleBand({ left: '' })).toBeUndefined();
    expect(parseArticleBand(['a'])).toBeUndefined();
    expect(parseArticleBand(null)).toBeUndefined();
  });

  it('is part of an article’s style, with Different First Page only as true', () => {
    expect(
      parseArticleStyle({
        header: { left: 'Brief' },
        footer: { right: '{page}' },
        differentFirstPage: true,
      }),
    ).toEqual({ header: { left: 'Brief' }, footer: { right: '{page}' }, differentFirstPage: true });
    expect(parseArticleStyle({ header: {}, differentFirstPage: 'yes' })).toBeUndefined();
  });
});

describe('what a page shows', () => {
  const values = { page: 2, pages: 5, name: 'Plan', date: '1 November 2026' };

  it('fills the fields, leaving other braces alone', () => {
    expect(fillBand('{name}: {page} of {pages}, {date} {other}', values)).toBe(
      'Plan: 2 of 5, 1 November 2026 {other}',
    );
  });

  it('draws each part filled, and nothing at all with no band and no numbers', () => {
    expect(
      articleBandsFor(
        { header: { left: '{name}', right: '  ' }, footer: { right: '{page}/{pages}' } },
        false,
        1,
        5,
        'Plan',
        'd',
      ),
    ).toEqual({ header: { left: 'Plan' }, footer: { right: '2/5' } });
    expect(articleBandsFor({ header: { center: 'H' } }, false, 0, 1, '', '')).toEqual({
      header: { center: 'H' },
    });
    expect(articleBandsFor(undefined, false, 0, 1, '', '')).toBeNull();
    expect(articleBandsFor({ header: { left: '{name}' } }, false, 0, 1, '', '')).toBeNull();
  });

  it('puts the page number in the footer’s centre unless the footer has a centre of its own', () => {
    expect(articleBandsFor(undefined, true, 2, 3, '', '')).toEqual({ footer: { center: '3' } });
    expect(articleBandsFor({ footer: { left: 'L' } }, true, 0, 3, '', '')).toEqual({
      footer: { left: 'L', center: '1' },
    });
    expect(articleBandsFor({ footer: { center: 'Draft' } }, true, 0, 3, '', '')).toEqual({
      footer: { center: 'Draft' },
    });
  });

  it('shows nothing on the first page with Different First Page, and counts on from 2', () => {
    const style = { header: { left: 'H' }, differentFirstPage: true };
    expect(articleBandsFor(style, true, 0, 3, '', '')).toBeNull();
    expect(articleBandsFor(style, true, 1, 3, '', '')).toEqual({
      header: { left: 'H' },
      footer: { center: '2' },
    });
  });

  it('writes the date in the reader’s long form', () => {
    expect(bandDate(new Date(2026, 10, 1))).toMatch(/2026/);
    expect(typeof bandDate()).toBe('string');
  });
});
