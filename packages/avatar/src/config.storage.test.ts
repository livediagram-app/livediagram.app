// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_DEFAULTS, configureAvatar } from './bindings';
import {
  DEFAULT_AVATAR_CONFIG,
  hasStoredAvatarConfig,
  loadAvatarConfig,
  parseAvatarConfig,
  randomAvatarConfig,
  saveAvatarConfig,
} from './config';

vi.mock('@liveworkspace/workbench/lib/random', async (importOriginal) => {
  const real = await importOriginal<typeof import('@liveworkspace/workbench/lib/random')>();
  return { ...real, randomPick: vi.fn(real.randomPick) };
});

afterEach(() => {
  configureAvatar(AVATAR_DEFAULTS);
  localStorage.clear();
});

// livediagram's docs/specs/008-canvas/avatar-mode.md "Persistence": the costume is kept in this browser, under the
// product's own key.
describe('the stored character', () => {
  it('keeps the costume under the product’s prefix', () => {
    configureAvatar({ ...AVATAR_DEFAULTS, storagePrefix: 'product:v2:' });
    expect(hasStoredAvatarConfig()).toBe(false);
    const mine = { ...DEFAULT_AVATAR_CONFIG, hair: 'afro' as const };
    saveAvatarConfig(mine);
    expect(localStorage.getItem('product:v2:avatar-config')).toBe(JSON.stringify(mine));
    expect(hasStoredAvatarConfig()).toBe(true);
    expect(loadAvatarConfig()).toEqual(mine);
  });

  it('rolls a fresh character on first use', () => {
    const rolled = loadAvatarConfig();
    expect(parseAvatarConfig(rolled)).toEqual(rolled);
    expect(hasStoredAvatarConfig()).toBe(false);
  });

  it('falls back to the default look when a roll draws nothing', async () => {
    const { randomPick } = await import('@liveworkspace/workbench/lib/random');
    vi.mocked(randomPick).mockReturnValue(undefined);
    expect(randomAvatarConfig()).toEqual(DEFAULT_AVATAR_CONFIG);
  });
});
