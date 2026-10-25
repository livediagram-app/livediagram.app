// The person's own Google picture (docs/specs/014-identity/profile-picture.md §1, §2): shown to them always,
// published to the room only while Show My Google Picture is on, and never one that is not Google's.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ownPicture,
  publishedPicture,
  resetOwnPictureForTests,
  setOwnPicture,
  setOwnPictureShown,
} from './own-picture';

const PICTURE = 'https://lh3.googleusercontent.com/a/me';

afterEach(resetOwnPictureForTests);

describe('own picture', () => {
  it('publishes the picture while the switch is on, and keeps it for your own chrome when off', () => {
    setOwnPicture({ picture: PICTURE, hidden: false });
    expect(publishedPicture(ownPicture())).toBe(PICTURE);
    setOwnPictureShown(false);
    expect(ownPicture().picture).toBe(PICTURE);
    expect(publishedPicture(ownPicture())).toBeNull();
    setOwnPictureShown(true);
    expect(publishedPicture(ownPicture())).toBe(PICTURE);
  });

  it('reads the session’s hidden flag, refuses a picture that is not Google’s, and forgets on sign-out', () => {
    setOwnPicture({ picture: PICTURE, hidden: true });
    expect(publishedPicture(ownPicture())).toBeNull();
    setOwnPicture({ picture: 'https://evil.example/me.png' });
    expect(ownPicture().picture).toBeNull();
    setOwnPicture({ picture: PICTURE });
    setOwnPicture(null);
    expect(ownPicture()).toEqual({ picture: null, hidden: false });
  });

  it('keeps the same snapshot, and tells no one, when nothing changed', () => {
    setOwnPicture({ picture: PICTURE });
    const before = ownPicture();
    setOwnPicture({ picture: PICTURE });
    setOwnPictureShown(true);
    expect(ownPicture()).toBe(before);
  });
});
