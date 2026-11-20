import { describe, expect, it } from 'vitest';
import { isRetiredSignInBannerEvent } from './retired-sign-in-banner';

// docs/specs/017-telemetry/telemetry.md "Retired features": the sign-in banner's Learn More and the Explorer's banner.
describe('isRetiredSignInBannerEvent', () => {
  it("retires Learn More on both surfaces and the Explorer's banner", () => {
    expect(isRetiredSignInBannerEvent('UI', 'Opened', 'SignInReasons')).toBe(true);
    expect(isRetiredSignInBannerEvent('UI', 'Opened', 'SignInReasonsEditor')).toBe(true);
    expect(isRetiredSignInBannerEvent('UI', 'Opened', 'SignInReasonsExplorer')).toBe(true);
    expect(isRetiredSignInBannerEvent('UI', 'Selected', 'SignInBannerExplorer')).toBe(true);
    expect(isRetiredSignInBannerEvent('UI', 'Closed', 'SignInBannerExplorer')).toBe(true);
  });

  it("keeps the editor's sign-in toast, which sends the banner's editor events", () => {
    expect(isRetiredSignInBannerEvent('UI', 'Selected', 'SignInBannerEditor')).toBe(false);
    expect(isRetiredSignInBannerEvent('UI', 'Closed', 'SignInBannerEditor')).toBe(false);
    expect(isRetiredSignInBannerEvent('UI', 'Opened', null)).toBe(false);
  });
});
