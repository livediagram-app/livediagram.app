import { describe, expect, it } from 'vitest';
import { SHARE_PASSWORD_STORAGE_PREFIX } from '@/app/pre-hydration-scripts';
import { SHARE_PASSWORD_CACHE_PREFIX } from './core';

// The boot script asks for a link's grant before the app loads (PLAN_GRANT_BOOT_SCRIPT), with the password this
// browser remembered for the link: it must read the key the app writes.
describe('share password cache key', () => {
  it('is the same for the boot script and the app', () => {
    expect(SHARE_PASSWORD_STORAGE_PREFIX).toBe(SHARE_PASSWORD_CACHE_PREFIX);
  });
});
