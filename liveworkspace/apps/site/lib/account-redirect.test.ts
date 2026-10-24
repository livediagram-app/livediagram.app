import { describe, expect, it } from 'vitest';
import { accountRedirect } from './account-redirect';

// Every old account address still lands, on the same section of the Settings panel, in the Explorer.
describe('accountRedirect', () => {
  it('sends /account and /account/settings to the panel on All', () => {
    expect(accountRedirect('/account', '', '')).toBe('/explorer?settings=all');
    expect(accountRedirect('/account/settings', '', '')).toBe('/explorer?settings=all');
    expect(accountRedirect('/account/settings/', '?app=all', '')).toBe('/explorer?settings=all');
    expect(accountRedirect('/account/settings', '', '#apps')).toBe('/explorer?settings=all');
  });

  it("keeps an Account category's anchor, every email's unsubscribe link among them", () => {
    for (const section of ['profile', 'notifications', 'privacy', 'accessibility', 'tokens']) {
      expect(accountRedirect('/account/settings', '', `#${section}`)).toBe(
        `/explorer?settings=${section}`,
      );
    }
  });

  it('keeps the app an address named, by its name or its site', () => {
    expect(accountRedirect('/account/settings', '?app=liveplanner', '')).toBe(
      '/explorer?settings=liveplanner',
    );
    expect(accountRedirect('/account/settings', '?app=livedesign.app', '')).toBe(
      '/explorer?settings=livedesign',
    );
    expect(accountRedirect('/account/settings', '?app=nope', '')).toBe('/explorer?settings=all');
  });

  it('sends /account/tokens to the panel on API Tokens', () => {
    expect(accountRedirect('/account/tokens', '', '')).toBe('/explorer?settings=tokens');
    expect(accountRedirect('/account/tokens/', '', '')).toBe('/explorer?settings=tokens');
  });
});
