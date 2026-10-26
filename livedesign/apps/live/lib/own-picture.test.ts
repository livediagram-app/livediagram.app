// Show My Google Picture across a token refresh (docs/specs/014-identity/profile-and-email-notifications.md
// "Avatars"). The accounts Worker mints every ID token's `picture_hidden` from the profile row
// (liveworkspace/apps/accounts/src/auth-options.ts idTokenClaims), so a refresh after a Settings › Profile save
// carries the saved switch: the session that follows the save agrees with it, and never turns it back on.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ownPicture,
  publishedPicture,
  resetOwnPicture,
  setOwnPicture,
  setOwnPictureShown,
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
