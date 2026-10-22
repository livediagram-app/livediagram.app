import { describe, expect, it } from 'vitest';
import {
  TAG_NAME_MAX,
  isTagColour,
  isTagId,
  nextTagColour,
  normaliseTagName,
  sortTags,
  tagNameKey,
} from './tags';

// docs/specs/013-workspace/tags.md "A tag".
describe('normaliseTagName', () => {
  it('trims and keeps inner whitespace runs as one space', () => {
    expect(normaliseTagName('  Client   work \n')).toBe('Client work');
  });

  it('refuses an empty, over-long or non-string name', () => {
    expect(normaliseTagName('   ')).toBeNull();
    expect(normaliseTagName('x'.repeat(TAG_NAME_MAX + 1))).toBeNull();
    expect(normaliseTagName(42)).toBeNull();
  });

  it('counts characters, not UTF-16 units, so an emoji name of the limit fits', () => {
    expect(normaliseTagName('🚀'.repeat(TAG_NAME_MAX))).toBe('🚀'.repeat(TAG_NAME_MAX));
  });
});

describe('tagNameKey', () => {
  it('compares names ignoring case and spacing', () => {
    expect(tagNameKey(' Design  Review')).toBe(tagNameKey('design review'));
  });
});

describe('isTagColour', () => {
  it('takes a standard colour name or a hex, nothing else', () => {
    expect(isTagColour('blue')).toBe(true);
    expect(isTagColour('#1A2b3c')).toBe(true);
    expect(isTagColour('chartreuse')).toBe(false);
    expect(isTagColour('#fff')).toBe(false);
    expect(isTagColour(null)).toBe(false);
  });
});

describe('isTagId', () => {
  it('takes a UUID and refuses odd characters or lengths', () => {
    expect(isTagId('7d1f2a5e-3b4c-4d5e-8f90-123456789abc')).toBe(true);
    expect(isTagId('a/b')).toBe(false);
    expect(isTagId('')).toBe(false);
    expect(isTagId('x'.repeat(65))).toBe(false);
  });
});

describe('nextTagColour', () => {
  it('starts with blue, then takes the least-used hue in order', () => {
    expect(nextTagColour([])).toBe('blue');
    expect(nextTagColour(['blue'])).toBe('green');
    expect(nextTagColour(['blue', 'green', 'orange'])).toBe('violet');
  });

  it('goes back round once every hue is used', () => {
    const all = ['blue', 'green', 'orange', 'violet', 'teal', 'pink', 'red', 'yellow'];
    expect(nextTagColour(all)).toBe('blue');
    expect(nextTagColour([...all, 'blue'])).toBe('green');
  });

  it('ignores custom colours', () => {
    expect(nextTagColour(['#123456'])).toBe('blue');
  });
});

describe('sortTags', () => {
  it('sorts by name, ignoring case and reading numbers as numbers', () => {
    const names = sortTags([
      { name: 'beta' },
      { name: 'Q10' },
      { name: 'Alpha' },
      { name: 'Q2' },
    ]).map((t) => t.name);
    expect(names).toEqual(['Alpha', 'beta', 'Q2', 'Q10']);
  });
});
