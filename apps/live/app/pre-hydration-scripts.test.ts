import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';
import { REDUCE_MOTION_BOOT_SCRIPT } from './pre-hydration-scripts';

// The editor's root layout inlines a reduce-motion `<script>` that runs before
// hydration (docs/specs/007-editor/user-preferences.md), interpolating a localStorage key
// into a SINGLE-QUOTED JavaScript string. A key reaching the server layout from a
// `'use client'` module arrives as a client-reference stub whose apostrophe breaks
// the string and throws on every load; the appearance script, shared by every app,
// is pinned the same way in packages/ui/src/appearance/appearance-boot.test.ts.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const LAYOUT = read('./layout.tsx');

describe('the reduce-motion pre-hydration script', () => {
  it('is inlined by the layout', () => {
    expect(LAYOUT).toContain('__html: REDUCE_MOTION_BOOT_SCRIPT');
  });

  it('carries a key that survives being quoted', () => {
    expect(USER_PREFERENCES_STORAGE_KEY).not.toMatch(/['"\\\n\r]/);
    expect(REDUCE_MOTION_BOOT_SCRIPT).toContain(`'${USER_PREFERENCES_STORAGE_KEY}'`);
  });

  it('reads its key from a module with no client boundary', () => {
    expect(read('../lib/user-preferences.ts')).not.toMatch(/^\s*['"]use client['"]/m);
    expect(read('./pre-hydration-scripts.ts')).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('adds reduce-motion only for a stored opt-in, and never throws', () => {
    const run = (stored: string | null, throwOnRead = false) => {
      const classes: string[] = [];
      new Function('localStorage', 'document', REDUCE_MOTION_BOOT_SCRIPT)(
        {
          getItem: () => {
            if (throwOnRead) throw new Error('denied');
            return stored;
          },
        },
        { documentElement: { classList: { add: (c: string) => classes.push(c) } } },
      );
      return classes;
    };
    expect(run(JSON.stringify({ reduceMotion: true }))).toEqual(['reduce-motion']);
    expect(run(JSON.stringify({ reduceMotion: false }))).toEqual([]);
    expect(run(null)).toEqual([]);
    expect(run('{not json')).toEqual([]);
    expect(() => run(null, true)).not.toThrow();
  });
});
