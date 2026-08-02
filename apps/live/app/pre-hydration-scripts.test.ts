import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UI_MODE_STORAGE_KEY } from '@/hooks/ui/ui-mode-storage';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';

// The root layout inlines two `<script>` tags that run before hydration: one
// applies the saved dark class, one applies reduce-motion (spec/07, spec/20).
// Both exist to avoid a flash of the wrong chrome on first paint, and both
// interpolate a localStorage key into a SINGLE-QUOTED JavaScript string.
//
// That interpolation is the fragile part, and it has already broken once.
// UI_MODE_STORAGE_KEY used to live in the `'use client'` useUiMode module;
// Next substituted a client-reference stub for the value in the server layout,
// the stub's text contains an apostrophe, the quoted string terminated early,
// and every page load threw a SyntaxError — so dark mode never applied before
// paint. The fix was ui-mode-storage.ts, a plain module with no client
// boundary, and its comment explains why it exists.
//
// Nothing enforced any of it. Folding that one-constant module back into the
// hook is exactly the tidy-up a reasonable person makes, and the failure it
// reintroduces is invisible to every other test: the build succeeds, the types
// are fine, and only a real browser shows the flash.

const LAYOUT = readFileSync(fileURLToPath(new URL('./layout.tsx', import.meta.url)), 'utf8');
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const INLINED = [
  {
    name: 'UI_MODE_STORAGE_KEY',
    value: UI_MODE_STORAGE_KEY,
    module: '../hooks/ui/ui-mode-storage.ts',
  },
  {
    name: 'USER_PREFERENCES_STORAGE_KEY',
    value: USER_PREFERENCES_STORAGE_KEY,
    module: '../lib/user-preferences.ts',
  },
];

describe('keys inlined into the pre-hydration scripts', () => {
  it('finds the scripts at all (guard against this test going blind)', () => {
    expect(LAYOUT).toContain('dangerouslySetInnerHTML');
    expect(LAYOUT.match(/dangerouslySetInnerHTML/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each(INLINED)('$name survives being quoted inside the script', ({ value }) => {
    // The direct guard on the failure mode: the key is interpolated into
    // `localStorage.getItem('<key>')`, so an apostrophe ends the string early
    // and a backslash or newline mangles it. This holds however the module is
    // organised, which is why it is asserted on the VALUE.
    expect(value).not.toMatch(/['"\\\n\r]/);
    expect(value.length).toBeGreaterThan(0);
  });

  it.each(INLINED)('$name really is interpolated into a script', ({ value }) => {
    // If the layout stops inlining the key, the assertions above still pass but
    // guard nothing. Pin that the key's value actually reaches a script tag.
    const scripts = [...LAYOUT.matchAll(/__html: `([^`]*)`/g)].map((m) => m[1]!);
    expect(scripts.some((s) => s.includes(`'\${`))).toBe(true);
    expect(LAYOUT).toContain(value.split(':')[0]!);
  });

  it.each(INLINED)('$name comes from a module with no client boundary', ({ module }) => {
    // A `'use client'` module hands the server layout a stub, not the string.
    // That is the original bug, and it is why ui-mode-storage.ts is separate
    // from the hook that re-exports it.
    const src = read(module);
    expect(src).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('keeps the layout itself a server component', () => {
    // The scripts only run pre-hydration because the layout renders on the
    // server. A 'use client' here would move them after hydration and the
    // flash returns for a different reason.
    expect(LAYOUT).not.toMatch(/^\s*['"]use client['"]/m);
  });
});
