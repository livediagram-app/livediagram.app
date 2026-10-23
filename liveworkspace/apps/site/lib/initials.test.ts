import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('takes the first letters of the first and last names', () => {
    expect(initials('Wendy Tran')).toBe('WT');
    expect(initials('  ada  lovelace king ')).toBe('AK');
  });

  it('takes one letter from a single name, and a placeholder from none', () => {
    expect(initials('Wendy')).toBe('W');
    expect(initials('')).toBe('?');
  });
});
