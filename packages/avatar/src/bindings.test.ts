import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_DEFAULTS, avatarBindings, configureAvatar } from './bindings';

afterEach(() => configureAvatar(AVATAR_DEFAULTS));

// Each product hands the package its facts once (livediagram's lib/avatar-bindings.ts).
describe('avatar bindings', () => {
  it('reads safe defaults until a product configures it', () => {
    expect(() => avatarBindings.track('UI', 'Changed', 'AvatarStatus')).not.toThrow();
    expect(avatarBindings.storagePrefix).toBe('avatar:v2:');
    expect(avatarBindings.shade('#0ea5e9', 0.2)).toBe('#0ea5e9');
    expect(avatarBindings.tint('#0ea5e9', 0.2)).toBe('#0ea5e9');
    expect(avatarBindings.identityVars('#0ea5e9')).toEqual({
      '--identity': '#0ea5e9',
      '--identity-deep': '#0ea5e9',
    });
  });

  it('reads the product’s facts once configured', () => {
    const track = vi.fn();
    configureAvatar({
      track,
      storagePrefix: 'product:v2:',
      shade: () => '#000000',
      tint: () => '#ffffff',
      identityVars: (color) => ({ color }),
    });
    avatarBindings.track('Canvas', 'Used', 'AvatarMessage');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AvatarMessage');
    expect(avatarBindings.storagePrefix).toBe('product:v2:');
    expect(avatarBindings.shade('#0ea5e9', 0.2)).toBe('#000000');
    expect(avatarBindings.tint('#0ea5e9', 0.2)).toBe('#ffffff');
    expect(avatarBindings.identityVars('#123456')).toEqual({ color: '#123456' });
  });
});
