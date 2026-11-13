import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { estimateArticle, wrapMeasured, type ArticleTextMeasure } from './article-layout-estimate';
import type { Style } from './article-layout-set';
import { laidOutPagesOf, newFlashcardPage } from './index';

// docs/specs/007-editor/flashcards.md "Long stacks stay quick": in a browser an unmounted card's lines break where its
// editor would break them. A stand-in measure: a glyph is 10 px in a 400 face, 12 in a 700, 11 in an italic.
const measure: ArticleTextMeasure = (text, font) =>
  text.length * (font.includes('700') ? 12 : font.startsWith('italic') ? 11 : 10);
const fontOf = (s: Style) => `${s.i ? 'italic ' : ''}${s.b ? '700' : '400'} 16px Inter`;
const set = { fontOf, px: 16, tracking: 0 };
const plain = (text: string): Style[] => Array.from(text, () => ({ b: false, i: false }));
const wrap = (text: string, width: number, styles = plain(text), s = set) =>
  wrapMeasured(text, styles, width, s, measure);

describe('wrapMeasured', () => {
  it('fits words while their measured widths do, a space between', () => {
    // "one two" is 70 px: it fits 70, not 69.
    expect(wrap('one two three', 70)).toEqual(['one two', 'three']);
    expect(wrap('one two three', 69)).toEqual(['one', 'two', 'three']);
  });

  it('measures a bold or italic stretch in its own face', () => {
    const text = 'aa bb cc';
    const styles = plain(text);
    styles[3] = styles[4] = { b: true, i: false };
    // "aa bb" is 20 + 10 + 24 = 54 px.
    expect(wrap(text, 54, styles)).toEqual(['aa bb', 'cc']);
    // "bb cc" is 24 + 10 + 20 = 54 too, so at 53 each word has a line.
    expect(wrap(text, 53, styles)).toEqual(['aa', 'bb', 'cc']);
    // An italic "aa" is 22: "aa bb" is 56.
    styles[0] = styles[1] = { b: false, i: true };
    expect(wrap(text, 55, styles)).toEqual(['aa', 'bb cc']);
    expect(wrap(text, 56, styles)).toEqual(['aa bb', 'cc']);
  });

  it('breaks after a hyphen inside a word, not one starting or ending it, or on its own', () => {
    expect(wrap('a well-known word', 70)).toEqual(['a well-', 'known', 'word']);
    expect(wrap('page 10-12 next', 80)).toEqual(['page 10-', '12 next']);
    expect(wrap('ab -cd', 45)).toEqual(['ab', '-cd']);
    expect(wrap('pre- and', 40)).toEqual(['pre-', 'and']);
    expect(wrap('so - then', 40)).toEqual(['so -', 'then']);
    expect(wrap('well-known', 200)).toEqual(['well-known']);
  });

  it('breaks a word wider than the line at the last character that fits', () => {
    expect(wrap('abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('go abcdefghij', 40)).toEqual(['go', 'abcd', 'efgh', 'ij']);
    expect(wrap('abcdefghij x', 40)).toEqual(['abcd', 'efgh', 'ij x']);
  });

  it('keeps a line a character wide however narrow, and every paragraph', () => {
    expect(wrap('ab', 5)).toEqual(['a', 'b']);
    expect(wrap('a\n\nb', 100)).toEqual(['a', '', 'b']);
    expect(wrap('', 100)).toEqual(['']);
    expect(wrap('  a   b ', 100)).toEqual(['a b']);
    // A character past the styles given is plain.
    expect(wrap('ab cd', 50, [])).toEqual(['ab cd']);
  });

  it('fits a line whole (Blink, Gecko) or word by word (WebKit), as the browser does', () => {
    // A kerned pair: a space before "w" is 4 px narrower when measured with it, as a whole line is.
    const kerned = (t: string) => t.length * 10 - 4 * (t.split(' w').length - 1);
    const whole: ArticleTextMeasure = (t) => kerned(t);
    const byWord: ArticleTextMeasure = Object.assign((t: string) => kerned(t), {
      wordByWord: true,
    });
    // "ab wx" is 50 px by its words, 46 whole.
    expect(wrapMeasured('ab wx', plain('ab wx'), 47, set, whole)).toEqual(['ab wx']);
    expect(wrapMeasured('ab wx', plain('ab wx'), 47, set, byWord)).toEqual(['ab', 'wx']);
    expect(wrapMeasured('ab wx', plain('ab wx'), 50, set, byWord)).toEqual(['ab wx']);
    // A hyphen's part joins the line with no space between, either way.
    expect(wrapMeasured('a well-known', plain('a well-known'), 70, set, byWord)).toEqual([
      'a well-',
      'known',
    ]);
  });

  it('counts letter spacing on every character', () => {
    // -0.0625 em at 16 px takes 1 px a character: "one two" is 70 - 7.
    expect(wrap('one two x', 63, undefined, { ...set, tracking: -0.0625 })).toEqual([
      'one two',
      'x',
    ]);
  });

  it('lays a whole card out by measure, and finishes a 50,000-character paragraph quickly', () => {
    const words = Array.from({ length: 60 }, (_, i) => (i % 3 ? 'mm' : 'i')).join(' ');
    const tab = {
      id: 't',
      name: 'Tab',
      elements: [],
      pages: [newFlashcardPage('p0', 'f0')],
      articles: { f0: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: words }] }] } },
    };
    const pages = laidOutPagesOf(tab as never);
    const lines = (m?: ArticleTextMeasure) =>
      [...estimateArticle(tab, 'f0', pages, '#000', m).ops.values()]
        .flat()
        .filter((o) => o.k === 'text').length;
    // Narrow "i"s and wide "m"s: the average glyph and the measure break the lines differently.
    const narrow: ArticleTextMeasure = (t) => [...t].reduce((w, c) => w + (c === 'i' ? 3 : 14), 0);
    expect(lines(narrow)).not.toBe(lines());
    const long = 'word '.repeat(10_000);
    let out: string[] = [];
    const cpu = cpuMsOf(() => {
      out = wrap(long, 300);
    });
    expect(out.length).toBeGreaterThan(1000);
    expect(cpu).toBeLessThan(cpuBudgetMs(200));
    // A 50,000-character word with no space breaks in linear time too.
    expect(cpuMsOf(() => wrap('x'.repeat(50_000), 300))).toBeLessThan(cpuBudgetMs(400));
  });
});
