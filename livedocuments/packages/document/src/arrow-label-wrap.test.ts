import { describe, expect, it } from 'vitest';
import { longestWordWidth, wrapBalanced, wrapGreedy } from './arrow-label-wrap';

// Fixed-width measure: 10px per character, spaces included.
const mono = (s: string) => s.length * 10;

describe('wrapGreedy', () => {
  it('keeps a short text on one line', () => {
    expect(wrapGreedy('Do coding work', 200, mono)).toEqual({
      lines: ['Do coding work'],
      width: 140,
    });
  });

  it('breaks at word boundaries when a line would exceed the width', () => {
    expect(wrapGreedy('Use personal assistant', 130, mono).lines).toEqual([
      'Use personal',
      'assistant',
    ]);
  });

  it('keeps explicit line breaks and wraps each line', () => {
    expect(wrapGreedy('Speech\nto text please', 70, mono).lines).toEqual([
      'Speech',
      'to text',
      'please',
    ]);
  });

  it('never breaks a word wider than the width', () => {
    expect(wrapGreedy('Supercalifragilistic ok', 50, mono)).toEqual({
      lines: ['Supercalifragilistic', 'ok'],
      width: 200,
    });
  });

  it('keeps an empty explicit line', () => {
    expect(wrapGreedy('a\n\nb', 100, mono).lines).toEqual(['a', '', 'b']);
  });
});

describe('wrapBalanced', () => {
  it('avoids an orphaned last word', () => {
    // Greedy at 260 strands "more"; the narrowest two-line split is 210 wide.
    const greedy = wrapGreedy('Context summarisation and more', 260, mono);
    expect(greedy.lines).toEqual(['Context summarisation and', 'more']);
    const balanced = wrapBalanced('Context summarisation and more', 260, mono);
    expect(balanced.lines).toEqual(['Context summarisation', 'and more']);
    expect(balanced.lines.length).toBe(greedy.lines.length);
    expect(balanced.width).toBeLessThan(greedy.width);
  });

  it('leaves a text that fits on one line alone', () => {
    expect(wrapBalanced('UI', 160, mono)).toEqual({ lines: ['UI'], width: 20 });
  });

  it('never goes narrower than the longest word', () => {
    const r = wrapBalanced('a bbbbbbbbbb c', 200, mono);
    expect(r.width).toBeGreaterThanOrEqual(100);
  });
});

describe('longestWordWidth', () => {
  it('measures the widest single word', () => {
    expect(longestWordWidth('to summarise it', mono)).toBe(90);
  });

  it('is zero for blank text', () => {
    expect(longestWordWidth('  \n ', mono)).toBe(0);
  });
});
