import { describe, expect, it } from 'vitest';
import {
  avatarScale,
  DEFAULT_AVATAR_CONFIG,
  parseAvatarConfig,
  type AvatarConfig,
} from './avatar-config';

describe('parseAvatarConfig', () => {
  const full: AvatarConfig = {
    gender: 'female',
    clothing: 'hoodie',
    hair: 'ponytail',
    size: 'tall',
  };

  it('round-trips a complete config, from an object or its JSON', () => {
    expect(parseAvatarConfig(full)).toEqual(full);
    expect(parseAvatarConfig(JSON.stringify(full))).toEqual(full);
  });

  it('falls back to the defaults for nothing stored / unparseable JSON', () => {
    expect(parseAvatarConfig(null)).toEqual(DEFAULT_AVATAR_CONFIG);
    expect(parseAvatarConfig('{not json')).toEqual(DEFAULT_AVATAR_CONFIG);
    expect(parseAvatarConfig(42)).toEqual(DEFAULT_AVATAR_CONFIG);
  });

  it('keeps the fields it recognises and defaults only the ones it does not', () => {
    // A stale option id (retired in a later release) must not cost the whole
    // character — only that one choice.
    const parsed = parseAvatarConfig({ ...full, clothing: 'spacesuit' });
    expect(parsed.clothing).toBe(DEFAULT_AVATAR_CONFIG.clothing);
    expect(parsed.gender).toBe('female');
    expect(parsed.hair).toBe('ponytail');
    expect(parsed.size).toBe('tall');
  });

  it('defaults missing fields, so a config written by an older build still loads', () => {
    expect(parseAvatarConfig({ gender: 'female' })).toEqual({
      ...DEFAULT_AVATAR_CONFIG,
      gender: 'female',
    });
  });
});

describe('avatarScale', () => {
  it('orders small < regular < tall, with regular at 1', () => {
    expect(avatarScale('regular')).toBe(1);
    expect(avatarScale('small')).toBeLessThan(1);
    expect(avatarScale('tall')).toBeGreaterThan(1);
  });
});
