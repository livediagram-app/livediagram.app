import { describe, expect, it } from 'vitest';
import {
  baseOf,
  compareNames,
  decodeTarget,
  dirOf,
  extOf,
  isPicturePath,
  keyOf,
  normalisePath,
  resolveFrom,
  stemOf,
} from './paths';

describe('archive paths', () => {
  it('normalises slashes, dots and empty segments', () => {
    expect(normalisePath('a\\b//./c.md')).toBe('a/b/c.md');
    expect(normalisePath('/a/b/../c.md')).toBe('a/c.md');
  });

  it('refuses a path that is empty or climbs out of the root', () => {
    expect(normalisePath('../secret.md')).toBeNull();
    expect(normalisePath('a/../../secret.md')).toBeNull();
    expect(normalisePath('./')).toBeNull();
  });

  it('takes a path apart', () => {
    expect(dirOf('a/b/c.md')).toBe('a/b');
    expect(dirOf('c.md')).toBe('');
    expect(baseOf('a/b/c.md')).toBe('c.md');
    expect(extOf('a/b/Photo.PNG')).toBe('png');
    expect(extOf('a/.hidden')).toBe('');
    expect(stemOf('a/b/c.tar.gz')).toBe('c.tar');
    expect(stemOf('a/LICENSE')).toBe('LICENSE');
  });

  it('gives two spellings of one path the same key', () => {
    expect(keyOf('Café/Page.MD')).toBe(keyOf('Café/page.md'));
  });

  it('decodes a link, and keeps a malformed one as written', () => {
    expect(decodeTarget('My%20Page.md')).toBe('My Page.md');
    expect(decodeTarget('100%.md')).toBe('100%.md');
  });

  it('resolves a link against its page folder, or from the root', () => {
    expect(resolveFrom('a/b', '../c.md')).toBe('a/c.md');
    expect(resolveFrom('a/b', '/c.md')).toBe('c.md');
    expect(resolveFrom('', 'c.md')).toBe('c.md');
    expect(resolveFrom('a', '../../c.md')).toBeNull();
  });

  it('orders names as a person does', () => {
    expect(['Page 10', 'page 2', 'Alpha'].toSorted(compareNames)).toEqual([
      'Alpha',
      'page 2',
      'Page 10',
    ]);
  });

  it('knows a picture by its extension', () => {
    expect(isPicturePath('a/b.JPG')).toBe(true);
    expect(isPicturePath('a/b.pdf')).toBe(false);
  });
});
