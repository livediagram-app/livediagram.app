import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runInlineScript } from '@liveworkspace/vitest-config/inline-script';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';
import { RANDOM_UUID_BOOT_SCRIPT } from '@liveplanner/ui';
import {
  REDUCE_MOTION_BOOT_SCRIPT,
  WEBFONTS_STYLESHEET_ID,
  WEBFONTS_SWAP_SCRIPT,
  SILENT_SIGN_IN_BOOT_SCRIPT,
  SILENT_SIGN_IN_SKIP_PATHS,
} from './pre-hydration-scripts';

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
    expect(LAYOUT).toContain('__html: trustedHtml(REDUCE_MOTION_BOOT_SCRIPT)');
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
      runInlineScript(REDUCE_MOTION_BOOT_SCRIPT, {
        localStorage: {
          getItem: () => {
            if (throwOnRead) throw new Error('denied');
            return stored;
          },
        },
        document: { documentElement: { classList: { add: (c: string) => classes.push(c) } } },
      });
      return classes;
    };
    expect(run(JSON.stringify({ reduceMotion: true }))).toEqual(['reduce-motion']);
    expect(run(JSON.stringify({ reduceMotion: false }))).toEqual([]);
    expect(run(null)).toEqual([]);
    expect(run('{not json')).toEqual([]);
    expect(() => run(null, true)).not.toThrow();
  });
});

describe('the webfonts stylesheet', () => {
  it('is linked so it never blocks first paint, with the swap script right after it', () => {
    expect(LAYOUT).toMatch(/id=\{WEBFONTS_STYLESHEET_ID\}[\s\S]*?media="print"/);
    expect(LAYOUT).toMatch(
      /media="print"[\s\S]*?\/>\s*<script dangerouslySetInnerHTML=\{\{ __html: trustedHtml\(WEBFONTS_SWAP_SCRIPT\) \}\} \/>/,
    );
  });

  const run = (link: unknown) => {
    const document = {
      getElementById: (id: string) => (id === WEBFONTS_STYLESHEET_ID ? link : null),
    };
    runInlineScript(WEBFONTS_SWAP_SCRIPT, { document });
  };

  it('switches the stylesheet to every medium once it loads', () => {
    let onLoad: () => void = () => {};
    const link = {
      media: 'print',
      sheet: null,
      addEventListener: (type: string, fn: () => void) => {
        if (type === 'load') onLoad = fn;
      },
    };
    run(link);
    expect(link.media).toBe('print');
    onLoad();
    expect(link.media).toBe('all');
  });

  it('switches at once when the stylesheet loaded before the script ran', () => {
    const link = { media: 'print', sheet: {}, addEventListener: () => {} };
    run(link);
    expect(link.media).toBe('all');
  });

  it('does nothing, and throws nothing, without the link', () => {
    expect(() => run(null)).not.toThrow();
  });
});

describe('the randomUUID pre-hydration script', () => {
  it('is inlined by the layout right after Trusted Types, before any app code', () => {
    const tt = LAYOUT.indexOf('trustedHtml(TRUSTED_TYPES_BOOT)');
    const uuid = LAYOUT.indexOf('trustedHtml(RANDOM_UUID_BOOT_SCRIPT)');
    expect(tt).toBeGreaterThan(-1);
    expect(uuid).toBeGreaterThan(tt);
    expect(uuid).toBeLessThan(LAYOUT.indexOf('<StaleBuildBoot'));
  });
  it('is the shared script', () => {
    expect(RANDOM_UUID_BOOT_SCRIPT).toContain('getRandomValues');
  });
});

// The guards themselves are pinned in @liveworkspace/auth-client (silent.test.ts); this pins liveplanner's wiring.
describe('SILENT_SIGN_IN_BOOT_SCRIPT', () => {
  it("bounces through this app's own api and reads only this app's cookies", () => {
    expect(SILENT_SIGN_IN_BOOT_SCRIPT).toContain(`"/api"+'/auth/silent?return='`);
    expect(SILENT_SIGN_IN_BOOT_SCRIPT).toContain("has('lp_signed_in','1')");
    expect(SILENT_SIGN_IN_BOOT_SCRIPT).toContain("has('lp_signed_out','1')");
    expect(SILENT_SIGN_IN_BOOT_SCRIPT).toContain("has('lp_silent')");
  });

  it('leaves the sign-in pages, the guest hand-off and embeds alone', () => {
    for (const path of ['/sign-in', '/get-started', '/auth', '/embed', '/workbench']) {
      expect(SILENT_SIGN_IN_SKIP_PATHS).toContain(path);
    }
    expect(SILENT_SIGN_IN_SKIP_PATHS).toContain('/form');
  });

  // A person signed in to liveworkspace who arrives from an AI tool is signed in on the way, not shown Sign in.
  it('signs the AI-tool consent and device pages in without a click', () => {
    expect(SILENT_SIGN_IN_SKIP_PATHS).not.toContain('/oauth');
  });
});
