import { describe, expect, it } from 'vitest';
import { avatarKeyClaimed, claimAvatarKeys } from './key-claims';

describe('key claims', () => {
  it('holds no key until a piece claims one', () => {
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
  });

  it('holds a claimed key while the claim stands, and gives it back after', () => {
    const release = claimAvatarKeys((e) => e.key === 'ArrowUp' || e.key === 'w');
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'w' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'ArrowLeft' })).toBe(false);
    release();
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
  });

  it('holds a key any one of several claims wants', () => {
    const a = claimAvatarKeys((e) => e.key === 's');
    const b = claimAvatarKeys((e) => e.key === 'ArrowDown' && !e.shiftKey);
    expect(avatarKeyClaimed({ key: 'ArrowDown' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'ArrowDown', shiftKey: true })).toBe(false);
    expect(avatarKeyClaimed({ key: 's' })).toBe(true);
    a();
    b();
    expect(avatarKeyClaimed({ key: 's' })).toBe(false);
  });
});
