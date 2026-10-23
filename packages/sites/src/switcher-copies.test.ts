import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every app's header switches between liveworkspace's sites with the same switcher
// (liveworkspace/docs/site-switcher.md). Each app's UI package holds its own copy, so the copies must not drift:
// change one, change them all.
const APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'];
const copy = (app: string) =>
  readFileSync(
    new URL(`../../../${app}/packages/ui/src/SiteSwitcher.tsx`, import.meta.url),
    'utf8',
  );

describe('the site switcher', () => {
  it('is the same in every app', () => {
    const [first, ...rest] = APPS.map(copy);
    for (const [i, other] of rest.entries()) expect(other, APPS[i + 1]).toBe(first);
  });
});
