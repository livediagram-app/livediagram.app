import { describe, expect, it } from 'vitest';

import { homepageFromManifest } from './homepage.ts';

describe('homepageFromManifest', () => {
  it.each([
    [{ homepage: 'https://react.dev' }, 'https://react.dev/'],
    [{ repository: 'https://github.com/a/b' }, 'https://github.com/a/b'],
    [{ repository: { url: 'git+https://github.com/a/b.git' } }, 'https://github.com/a/b'],
    [{ repository: 'git://github.com/a/b.git' }, 'https://github.com/a/b'],
    [{ repository: 'github:a/b' }, 'https://github.com/a/b'],
    [{ repository: 'a/b' }, 'https://github.com/a/b'],
    [{ repository: { url: 'git@github.com:a/b.git' } }, 'https://github.com/a/b'],
    [{ homepage: 'http://insecure.example', repository: 'a/b' }, 'https://github.com/a/b'],
  ])('reads %j', (manifest, url) => {
    expect(homepageFromManifest(manifest)).toBe(url);
  });

  it.each([
    [{}],
    [{ homepage: 'javascript:alert(1)' }],
    [{ homepage: 'not a url' }],
    [{ repository: { type: 'git' } }],
    [{ repository: 'gitlab:a/b' }],
    [{ repository: 3 }],
  ])('offers nothing for %j', (manifest) => {
    expect(homepageFromManifest(manifest)).toBeUndefined();
  });
});
