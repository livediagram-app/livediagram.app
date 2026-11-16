import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH, copyName, initialsOf, truncateName } from './names';

describe('truncateName', () => {
  it('leaves a name at the cap whole and cuts one past it to the cap', () => {
    expect(truncateName('x'.repeat(NAME_MAX_LENGTH))).toBe('x'.repeat(NAME_MAX_LENGTH));
    expect([...truncateName('x'.repeat(NAME_MAX_LENGTH + 1))].length).toBe(NAME_MAX_LENGTH);
  });

  it('leaves a name that already fits alone', () => {
    expect(truncateName('Q3 roadmap')).toBe('Q3 roadmap');
    expect(truncateName('  padded  ')).toBe('padded');
  });

  it('collapses the whitespace a pasted block drags in', () => {
    // This is the case the cap exists for: auto-naming off pasted text.
    expect(truncateName('First line\nSecond   line\tthird')).toBe('First line Second line third');
  });

  it('never exceeds the cap', () => {
    const long = 'word '.repeat(60);
    expect([...truncateName(long)].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('breaks at a word boundary and marks the cut', () => {
    const out = truncateName(
      'Quarterly platform migration planning and rollout for the whole engineering org',
    );
    expect(out.endsWith('…')).toBe(true);
    // The cut lands between words, so the last word is whole.
    expect(out.slice(0, -1).trimEnd().split(' ').pop()).not.toBe('');
    expect(out).not.toContain('  ');
  });

  it('hard-cuts a single enormous word rather than truncating to nothing', () => {
    // A URL or hash has no space to break on; a word-boundary-only rule
    // would leave just the ellipsis.
    const out = truncateName('x'.repeat(200));
    expect([...out].length).toBe(NAME_MAX_LENGTH);
    expect(out.endsWith('…')).toBe(true);
  });

  it('counts characters the way a reader does, not UTF-16 units', () => {
    const emoji = '🎯'.repeat(100);
    expect([...truncateName(emoji)].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('handles an empty or whitespace-only name', () => {
    expect(truncateName('')).toBe('');
    expect(truncateName('   \n ')).toBe('');
  });
});

describe('initialsOf', () => {
  it("takes the first and last words, or a single word's first two letters", () => {
    expect(initialsOf('Curious Falcon')).toBe('CF');
    expect(initialsOf('ada lovelace byron')).toBe('AB');
    expect(initialsOf('owl')).toBe('OW');
    expect(initialsOf('   ')).toBe('?');
  });

  it('keeps an astral letter whole, never half a surrogate pair', () => {
    expect(initialsOf('\u{1D49C}da Byron')).toBe('\u{1D49C}B');
  });

  it('skips punctuation and symbols, taking only letters and numbers', () => {
    expect(initialsOf('<Oscar>')).toBe('OS');
    expect(initialsOf('"Ada" (Lovelace)')).toBe('AL');
    expect(initialsOf("O'Brien")).toBe('OB');
    expect(initialsOf('Ada - Lovelace')).toBe('AL');
    expect(initialsOf('3D Studio')).toBe('3S');
  });

  it('skips emoji, as words or inside them', () => {
    expect(initialsOf('\u{1F680} Launch')).toBe('LA');
    expect(initialsOf('Team \u{1F680}')).toBe('TE');
    expect(initialsOf('\u{1F680}Ada Lovelace\u{2728}')).toBe('AL');
  });

  it('reads right-to-left and CJK names by their own letters', () => {
    expect(initialsOf('محمد علي')).toBe('مع');
    expect(initialsOf('דוד לוי')).toBe('דל');
    expect(initialsOf('山田 太郎')).toBe('山太');
    expect(initialsOf('山田太郎')).toBe('山田');
    expect(initialsOf('Алексей Иванов')).toBe('АИ');
  });

  it('falls back to the email for a name with no letters, else a question mark', () => {
    expect(initialsOf('\u{1F680}', 'ada.lovelace@example.com')).toBe('AL');
    expect(initialsOf('<>', 'wendy@example.com')).toBe('WE');
    expect(initialsOf('\u{1F680}')).toBe('?');
    expect(initialsOf('', '')).toBe('?');
    expect(initialsOf('Ada', 'zed@example.com')).toBe('AD');
  });

  it('reads an email as the words of its local part', () => {
    expect(initialsOf('ada.lovelace@example.com')).toBe('AL');
    expect(initialsOf('ada_lovelace@example.com')).toBe('AL');
    expect(initialsOf('wendy@example.com')).toBe('WE');
  });
});

describe('copyName', () => {
  it('adds (copy) to a name that leaves room for it', () => {
    expect(copyName('Q3 roadmap')).toBe('Q3 roadmap (copy)');
  });

  it('cuts a long name so the copy still fits the cap and still says (copy)', () => {
    for (const name of ['x'.repeat(NAME_MAX_LENGTH), 'word '.repeat(200), 'y'.repeat(500)]) {
      const out = copyName(name);
      expect([...out].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
      expect(out.endsWith('… (copy)')).toBe(true);
    }
  });

  it('keeps a name that fits with its suffix whole', () => {
    const name = 'x'.repeat(NAME_MAX_LENGTH - ' (copy)'.length);
    expect(copyName(name)).toBe(`${name} (copy)`);
    expect([...copyName(name)].length).toBe(NAME_MAX_LENGTH);
  });
});
