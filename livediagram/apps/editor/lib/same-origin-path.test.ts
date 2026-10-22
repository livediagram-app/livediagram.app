import { describe, expect, it } from 'vitest';
import { sameOriginPath } from './same-origin-path';

describe('sameOriginPath', () => {
  it('keeps a same-origin path, query and hash', () => {
    expect(sameOriginPath('/explorer?x=1#y')).toBe('/explorer?x=1#y');
  });

  it.each([
    null,
    '',
    'evil.example',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/ /evil.example',
    '/\u007f/evil.example',
  ])('refuses %j', (path) => {
    expect(sameOriginPath(path)).toBeNull();
  });
});
