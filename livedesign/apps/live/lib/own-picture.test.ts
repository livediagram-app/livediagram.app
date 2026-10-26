// @vitest-environment jsdom
// Show My Google Picture across a token refresh (docs/specs/014-identity/profile-and-email-notifications.md
// "Avatars"). The accounts Worker mints every ID token's `picture_hidden` from the profile row
// (liveworkspace/apps/accounts/src/auth-options.ts idTokenClaims), so a refresh after a Settings › Profile save
// carries the saved switch: the session that follows the save agrees with it, and never turns it back on.
import { afterEach, describe, expect, it } from 'vitest';
import {
  notePictureSettingSaved,
  ownPicture,
  publishedPicture,
  resetOwnPicture,
  setOwnPicture,
  setOwnPictureShown,
  tokenPredatesPictureSetting,
} from './own-picture';

const PICTURE = 'https://lh3.googleusercontent.com/a/me';

afterEach(resetOwnPicture);

describe('own picture across a token refresh', () => {
  it('stays hidden when the refresh after the save says so', () => {
    setOwnPicture(PICTURE, false);
    setOwnPictureShown(false);
    expect(publishedPicture(ownPicture())).toBeNull();
    // The next session's ID token, minted after the save, carries picture_hidden.
    setOwnPicture(PICTURE, true);
    expect(publishedPicture(ownPicture())).toBeNull();
    expect(ownPicture().picture).toBe(PICTURE);
  });

  it('follows the session when the switch moved elsewhere (another app, another tab)', () => {
    setOwnPicture(PICTURE, true);
    setOwnPicture(PICTURE, false);
    expect(publishedPicture(ownPicture())).toBe(PICTURE);
  });

  it('forgets the picture on sign-out, and tells no one when nothing changed', () => {
    setOwnPicture(PICTURE, false);
    const before = ownPicture();
    setOwnPicture(PICTURE, false);
    setOwnPictureShown(true);
    expect(ownPicture()).toBe(before);
    setOwnPicture(null, false);
    expect(publishedPicture(ownPicture())).toBeNull();
    expect(ownPicture().picture).toBeNull();
  });
});

// A second tab refreshing inside the accounts Worker's reuse window gets the first tab's earlier response, minted
// before a Show My Google Picture save: the token is older than the save, so the page refreshes again.
describe('a token older than the picture setting', () => {
  afterEach(() => localStorage.clear());

  it('is older when it was issued before the last save, in any tab of this browser', () => {
    notePictureSettingSaved(100_000);
    expect(tokenPredatesPictureSetting(20_000, 110_000)).toBe(true);
    expect(tokenPredatesPictureSetting(5_000, 110_000)).toBe(false);
  });

  it('is never older without a save, or without an age', () => {
    expect(tokenPredatesPictureSetting(20_000, 110_000)).toBe(false);
    notePictureSettingSaved(100_000);
    expect(tokenPredatesPictureSetting(undefined, 110_000)).toBe(false);
  });

  it('reads no save from storage it cannot use', () => {
    localStorage.setItem('livedesign:v2:picture-setting-saved-at', 'nope');
    expect(tokenPredatesPictureSetting(20_000, 110_000)).toBe(false);
  });
});
