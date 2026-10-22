import { describe, expect, it } from 'vitest';
import { pictureHost, pictureSrc, pictureSrcSet } from './profile-picture';

// A Clerk image URL of the Google picture's proxy kind (its path is opaque to these helpers).
const GOOGLE = 'https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ';

// The transform (spec §2): size only, never a crop. `fit=crop` made Clerk serve a 160x96 band that
// the circle then cropped again, zooming the face in; a size alone keeps Google's framing.
describe('pictureSrc', () => {
  it('asks Clerk for a square size and nothing else', () => {
    expect(pictureSrc(GOOGLE, 96)).toBe(`${GOOGLE}?width=96&height=96`);
  });

  it('replaces any size or fit already on the URL', () => {
    expect(pictureSrc(`${GOOGLE}?width=400&fit=crop&quality=90`, 192)).toBe(
      `${GOOGLE}?width=192&quality=90&height=192`,
    );
  });

  it('offers a 1x and a 2x source for the browser to choose from', () => {
    expect(pictureSrcSet(GOOGLE)).toBe(
      `${GOOGLE}?width=96&height=96 96w, ${GOOGLE}?width=192&height=192 192w`,
    );
  });
});

describe('pictureHost', () => {
  it('names the host only, never the path', () => {
    expect(pictureHost('https://img.clerk.com/secret-id?width=96')).toBe('img.clerk.com');
    expect(pictureHost('nonsense')).toBe('invalid');
  });
});
