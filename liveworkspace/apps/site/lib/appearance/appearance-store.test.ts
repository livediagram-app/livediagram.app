// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.livehuddle.app/explorer/recent"}
// The site's Appearance store on an app's address (liveworkspace/docs/specs/010-site/site.md "Behaviour"): here
// livehuddle's. The Explorer's switch reads and writes livehuddle's own key, never the platform's.
import { afterEach, describe, expect, it } from 'vitest';
import { APP_APPEARANCE_KEYS, PLATFORM_APPEARANCE_KEY } from './appearance-keys';
import { SITE_APPEARANCE_STORE } from './appearance-store';

const KEY = APP_APPEARANCE_KEYS.livehuddle;

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  SITE_APPEARANCE_STORE.resetAppearanceForTests();
});

describe("the site's Appearance store on livehuddle's address", () => {
  it("reads livehuddle's pick, not the platform's", () => {
    localStorage.setItem(KEY, 'dark');
    localStorage.setItem(PLATFORM_APPEARANCE_KEY, 'light');
    expect(SITE_APPEARANCE_STORE.getAppearanceSetting()).toBe('dark');
    expect(SITE_APPEARANCE_STORE.getResolvedAppearance()).toBe('dark');
  });

  it("writes a pick to livehuddle's key and paints it", () => {
    SITE_APPEARANCE_STORE.setAppearance('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(localStorage.getItem(PLATFORM_APPEARANCE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
