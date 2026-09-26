import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY } from '@/hooks/ui/appearance-storage';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';
import { APPEARANCE_BOOT_SCRIPT, REDUCE_MOTION_BOOT_SCRIPT } from './pre-hydration-scripts';

// The root layout inlines two `<script>` tags that run before hydration: one
// applies the saved appearance, one applies reduce-motion (docs/specs/007-editor/live-app.md, docs/specs/007-editor/user-preferences.md).
// Both exist to avoid a flash of the wrong chrome on first paint, and both
// interpolate a localStorage key into a SINGLE-QUOTED JavaScript string.
//
// That interpolation is the fragile part, and it has already broken once.
// APPEARANCE_STORAGE_KEY used to live in the `'use client'` useAppearance module;
// Next substituted a client-reference stub for the value in the server layout,
// the stub's text contains an apostrophe, the quoted string terminated early,
// and every page load threw a SyntaxError — so dark mode never applied before
// paint. The fix was appearance-storage.ts, a plain module with no client
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
    name: 'APPEARANCE_STORAGE_KEY',
    value: APPEARANCE_STORAGE_KEY,
    script: APPEARANCE_BOOT_SCRIPT,
    module: '../hooks/ui/appearance-storage.ts',
  },
  {
    name: 'USER_PREFERENCES_STORAGE_KEY',
    value: USER_PREFERENCES_STORAGE_KEY,
    script: REDUCE_MOTION_BOOT_SCRIPT,
    module: '../lib/user-preferences.ts',
  },
];

describe('keys inlined into the pre-hydration scripts', () => {
  it('finds the scripts at all (guard against this test going blind)', () => {
    expect(LAYOUT).toContain('dangerouslySetInnerHTML');
    expect(LAYOUT.match(/dangerouslySetInnerHTML/g)?.length).toBeGreaterThanOrEqual(2);
    expect(LAYOUT).toContain('APPEARANCE_BOOT_SCRIPT');
    expect(LAYOUT).toContain('REDUCE_MOTION_BOOT_SCRIPT');
  });

  it.each(INLINED)('$name survives being quoted inside the script', ({ value }) => {
    // The direct guard on the failure mode: the key is interpolated into
    // `localStorage.getItem('<key>')`, so an apostrophe ends the string early
    // and a backslash or newline mangles it. This holds however the module is
    // organised, which is why it is asserted on the VALUE.
    expect(value).not.toMatch(/['"\\\n\r]/);
    expect(value.length).toBeGreaterThan(0);
  });

  it.each(INLINED)('$name really is interpolated into its script', ({ value, script }) => {
    // If a script stops reading the key, the assertions above still pass but
    // guard nothing. Pin that the key's value actually reaches the source.
    expect(script).toContain(`'${value}'`);
  });

  it.each(INLINED)('$name comes from a module with no client boundary', ({ module }) => {
    // A `'use client'` module hands the server layout a stub, not the string.
    // That is the original bug, and it is why appearance-storage.ts is separate
    // from the hook that re-exports it.
    const src = read(module);
    expect(src).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('keeps the script module itself free of a client boundary', () => {
    expect(read('./pre-hydration-scripts.ts')).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('keeps the layout itself a server component', () => {
    // The scripts only run pre-hydration because the layout renders on the
    // server. A 'use client' here would move them after hydration and the
    // flash returns for a different reason.
    expect(LAYOUT).not.toMatch(/^\s*['"]use client['"]/m);
  });
});

// Run the appearance script the way the browser does — as source, against a
// stub document — because the thing that matters is not its text but which
// stored values end up dark before first paint. A string assertion would have
// happily passed while 'system' painted light on a dark-themed machine.
function runAppearanceBoot(opts: {
  stored?: string | null;
  osPrefersDark?: boolean;
  matchMedia?: boolean;
  throwOnRead?: boolean;
}): { classes: string[] } {
  const classes: string[] = [];
  const stubs = {
    localStorage: {
      getItem: (): string | null => {
        if (opts.throwOnRead) throw new Error('denied');
        return opts.stored ?? null;
      },
    },
    matchMedia:
      opts.matchMedia === false
        ? undefined
        : (query: string) => ({ matches: !!opts.osPrefersDark && query.includes('dark') }),
    document: { documentElement: { classList: { add: (c: string) => classes.push(c) } } },
  };
  // The script runs at global scope in the browser; here the three globals it
  // touches are parameters, which is the same lookup with an explicit stub.
  new Function('localStorage', 'matchMedia', 'document', APPEARANCE_BOOT_SCRIPT)(
    stubs.localStorage,
    stubs.matchMedia,
    stubs.document,
  );
  return { classes };
}

describe('the appearance boot script', () => {
  it('paints dark for a stored Dark', () => {
    expect(runAppearanceBoot({ stored: 'dark' }).classes).toEqual(['dark']);
  });

  it('leaves a stored Light alone, even on a dark-themed OS', () => {
    expect(runAppearanceBoot({ stored: 'light', osPrefersDark: true }).classes).toEqual([]);
  });

  it('follows the device when nothing is stored, which is the default', () => {
    // System is the default (docs/specs/007-editor/live-app.md), so a first-time visitor on a dark
    // machine must land dark BEFORE first paint — the one case where getting
    // this script wrong is most visible, because it is everybody's first load.
    expect(runAppearanceBoot({ stored: null, osPrefersDark: true }).classes).toEqual(['dark']);
    expect(runAppearanceBoot({ stored: null, osPrefersDark: false }).classes).toEqual([]);
  });

  it('falls back to the device for a value it does not recognise', () => {
    // A half-written or older-build value reads as the default, and the
    // default consults the device.
    expect(runAppearanceBoot({ stored: 'Dark', osPrefersDark: true }).classes).toEqual(['dark']);
  });

  it('follows the OS for a stored System', () => {
    expect(runAppearanceBoot({ stored: 'system', osPrefersDark: true }).classes).toEqual(['dark']);
    expect(runAppearanceBoot({ stored: 'system', osPrefersDark: false }).classes).toEqual([]);
  });

  it('survives a browser with no matchMedia', () => {
    expect(() => runAppearanceBoot({ stored: 'system', matchMedia: false })).not.toThrow();
    expect(runAppearanceBoot({ stored: 'system', matchMedia: false }).classes).toEqual([]);
  });

  it('survives localStorage being unavailable', () => {
    // Safari private mode / a blocked third-party context. The script must
    // never throw: it runs before hydration, so an exception here takes the
    // rest of the inline boot with it.
    expect(() => runAppearanceBoot({ throwOnRead: true })).not.toThrow();
  });
});
