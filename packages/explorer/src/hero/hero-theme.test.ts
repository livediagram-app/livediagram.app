import { describe, expect, it } from 'vitest';
import { APPS } from '@liveworkspace/index-client';
import { APP_BACKDROP, heroHeadingFace, startHeadingFace } from './hero-theme';

// liveworkspace/docs/specs/004-index/one-explorer.md "Each app's backdrop, on Home's hero"
describe('each app’s hero theme', () => {
  it('gives every app a backdrop of its own, none the All Apps dots', () => {
    const kinds = APPS.map((app) => APP_BACKDROP[app]);
    expect(new Set(kinds).size).toBe(APPS.length);
    expect(kinds).not.toContain('dots');
  });

  it('sets only the Typesetter’s headings in serif, on the hero and the start header alike', () => {
    for (const app of APPS) {
      const kind = APP_BACKDROP[app];
      const serif = kind === 'typesetter';
      expect(heroHeadingFace(kind).includes('font-serif')).toBe(serif);
      expect(startHeadingFace(kind).includes('font-serif')).toBe(serif);
    }
  });
});
