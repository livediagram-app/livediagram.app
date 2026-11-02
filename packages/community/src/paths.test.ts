import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_HOME_PATH,
  communityImagePath,
  communityKeyStorage,
  communityPostPath,
} from './paths';

describe('community paths', () => {
  it('names the gallery, a post page and a card image the same way on every site', () => {
    expect(COMMUNITY_HOME_PATH).toBe('/community/');
    expect(communityPostPath('a b')).toBe('/community/post/?id=a%20b');
    expect(communityImagePath('c/d')).toBe('/share/c%2Fd/image.svg');
  });

  it('keeps each app its own browser key', () => {
    expect(communityKeyStorage('livediagram')).toBe('livediagram:v2:community-key');
    expect(communityKeyStorage('livedocuments')).toBe('livedocuments:v2:community-key');
  });
});
