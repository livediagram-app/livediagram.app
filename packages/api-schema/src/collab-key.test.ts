import { describe, expect, it } from 'vitest';
import { COLLAB_KEY_LENGTH, isCollabKey } from './collab-key';

describe('isCollabKey', () => {
  it('takes exactly 32 lowercase hex characters', () => {
    expect(isCollabKey('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(COLLAB_KEY_LENGTH).toBe(32);
  });

  it('refuses any other shape', () => {
    expect(isCollabKey('0123456789ABCDEF0123456789ABCDEF')).toBe(false);
    expect(isCollabKey('0123456789abcdef0123456789abcde')).toBe(false);
    expect(isCollabKey('0123456789abcdef0123456789abcdef0')).toBe(false);
    expect(isCollabKey('e3b0c442-98fc-1c14-9afb-f4c8996fb924')).toBe(false);
    expect(isCollabKey('')).toBe(false);
    expect(isCollabKey(null)).toBe(false);
    expect(isCollabKey(42)).toBe(false);
  });
});
