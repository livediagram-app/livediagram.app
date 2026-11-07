import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_HOME_PATH,
  communityImagePath,
  communityKeyStorage,
  communityPostPath,
  communityViewerPath,
} from './paths';

describe('community paths', () => {
  it('names the gallery, a post page and a card image the same way on every site', () => {
    expect(COMMUNITY_HOME_PATH).toBe('/community');
    expect(communityPostPath('a b')).toBe('/community/post?id=a%20b');
    expect(communityImagePath('c/d')).toBe('/share/c%2Fd/image.svg');
  });

  it("opens a post's document, or a copy of it, on its own app", () => {
    expect(communityViewerPath('livediagram.app', 'a b')).toBe('/document/shared?s=a%20b');
    expect(communityViewerPath('livedesign.app', 'C1', true)).toBe('/design/shared?s=C1&copy=1');
    expect(communityViewerPath('liveplanner.app', 'P1', true)).toBe('/project/shared?s=P1&copy=1');
  });

  it('keeps each app its own browser key', () => {
    expect(communityKeyStorage('livediagram')).toBe('livediagram:v2:community-key');
    expect(communityKeyStorage('livedocuments')).toBe('livedocuments:v2:community-key');
  });
});
