import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH, truncateName } from './names';

describe('truncateName', () => {
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
