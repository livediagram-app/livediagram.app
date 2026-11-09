import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_DEFAULTS, configureAvatar } from './bindings';
import { avatarScale } from './config';

// A product can leave the Size choice out (AvatarBindings.sizes): everyone draws at Regular.
describe('avatarScale without sizes', () => {
  afterEach(() => configureAvatar({ ...AVATAR_DEFAULTS }));

  it('scales by size while sizes are on, and draws every size at Regular when off', () => {
    expect(avatarScale('tall')).toBeGreaterThan(avatarScale('regular'));
    configureAvatar({ ...AVATAR_DEFAULTS, sizes: false });
    expect(avatarScale('tall')).toBe(avatarScale('regular'));
    expect(avatarScale('small')).toBe(avatarScale('regular'));
  });
});
