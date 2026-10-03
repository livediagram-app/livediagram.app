import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isMobileViewportSync,
  MOBILE_BREAKPOINT_PX,
  PHONE_MAX_HEIGHT_PX,
  PHONE_MEDIA_QUERY,
} from './responsive';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isMobileViewportSync', () => {
  it('returns false in non-browser contexts so SSR / static-export builds default to desktop', () => {
    vi.stubGlobal('window', undefined);
    expect(isMobileViewportSync()).toBe(false);
  });

  it('returns true when matchMedia reports a viewport under the sm breakpoint', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    expect(isMobileViewportSync()).toBe(true);
  });

  it('returns false when matchMedia reports a viewport at or above the sm breakpoint', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    expect(isMobileViewportSync()).toBe(false);
  });

  it('queries the sm breakpoint minus one pixel, or a short touch screen (a landscape phone)', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('window', { matchMedia });
    isMobileViewportSync();
    expect(matchMedia).toHaveBeenCalledWith(PHONE_MEDIA_QUERY);
    expect(PHONE_MEDIA_QUERY).toBe(
      `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px), (pointer: coarse) and (max-height: ${PHONE_MAX_HEIGHT_PX - 1}px)`,
    );
  });

  it('matches the `phone:` CSS variant, so JS and CSS flip together', () => {
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    expect(css).toContain(`@media ${PHONE_MEDIA_QUERY}`);
  });

  it('returns false when window exists but matchMedia is missing (very old browsers, jsdom)', () => {
    vi.stubGlobal('window', {});
    expect(isMobileViewportSync()).toBe(false);
  });
});
