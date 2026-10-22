import { describe, expect, it } from 'vitest';
import { homeBannerShown } from './home-banner';

// docs/specs/013-workspace/explorer-home.md "Hiding the banner": shown unless its close (or Settings) said no.
describe('homeBannerShown', () => {
  it('is shown by default and hidden only by an explicit false', () => {
    expect(homeBannerShown({})).toBe(true);
    expect(homeBannerShown({ homeBanner: true })).toBe(true);
    expect(homeBannerShown({ homeBanner: false })).toBe(false);
  });
});
