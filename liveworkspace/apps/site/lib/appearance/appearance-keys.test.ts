import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInlineScript } from '@liveworkspace/vitest-config/inline-script';
import { LOCAL_PORTS, type AppName } from '@liveworkspace/sites';
import {
  APP_APPEARANCE_KEYS,
  PLATFORM_APPEARANCE_KEY,
  appearanceKeyForHost,
  siteAppearanceBootScript,
} from './appearance-keys';

// liveworkspace/docs/specs/010-site/site.md "Behaviour": a page here is light or dark as the app whose address it is
// on, read from that app's own key; on liveworkspace.app, the platform's own.

const REPO = join(import.meta.dirname, '../../../../..');
const SCRIPT = siteAppearanceBootScript();

// Runs the inline script as the browser does, against stub globals: which class it adds for what is stored where.
function boot(host: string, stored: Record<string, string>, osDark = false): string[] {
  const classes: string[] = [];
  runInlineScript(SCRIPT, {
    location: { host },
    localStorage: { getItem: (key: string) => stored[key] ?? null },
    matchMedia: (query: string) => ({ matches: osDark && query.includes('dark') }),
    document: { documentElement: { classList: { add: (c: string) => classes.push(c) } } },
  });
  return classes;
}

const OTHER_APPS = ['livehuddle', 'liveplanner', 'livedocuments', 'livedesign'] as const;

describe('each app keeps its own key', () => {
  it.each(Object.keys(APP_APPEARANCE_KEYS) as AppName[])(
    "names %s's key as its UI package does",
    (app) => {
      const source = readFileSync(
        join(REPO, app, 'packages/ui/src/appearance/appearance-storage.ts'),
        'utf8',
      );
      expect(source).toContain(`APPEARANCE_STORAGE_KEY = '${APP_APPEARANCE_KEYS[app]}'`);
    },
  );

  it('keeps the platform on the key the site has always read', () => {
    expect(PLATFORM_APPEARANCE_KEY).toBe('livediagram:v2:ui-mode');
  });
});

describe.each(OTHER_APPS)('the Explorer on %s', (app) => {
  const key = APP_APPEARANCE_KEYS[app];
  const site = `${app}.app`;
  const port = LOCAL_PORTS[site as keyof typeof LOCAL_PORTS];

  it("reads the app's key on its address, live, staging and local", () => {
    for (const host of [site, `www.${site}`, `staging.${site}`, `localhost:${port}`]) {
      expect(appearanceKeyForHost(host)).toBe(key);
    }
    // Anywhere in the app's local port block, and on 127.0.0.1 too.
    expect(appearanceKeyForHost(`localhost:${port + 2}`)).toBe(key);
    expect(appearanceKeyForHost(`127.0.0.1:${port + 15}`)).toBe(key);
  });

  it("paints dark before first paint for the app's Dark", () => {
    expect(boot(`www.${site}`, { [key]: 'dark' })).toEqual(['dark']);
    expect(boot(`localhost:${port + 2}`, { [key]: 'dark' })).toEqual(['dark']);
  });

  it("stays light for the app's Light, whatever the platform's key or the device says", () => {
    expect(
      boot(`www.${site}`, { [key]: 'light', [PLATFORM_APPEARANCE_KEY]: 'dark' }, true),
    ).toEqual([]);
  });

  it("ignores the platform's key there", () => {
    expect(boot(`www.${site}`, { [PLATFORM_APPEARANCE_KEY]: 'dark' })).toEqual([]);
  });

  it('follows the device when the app has no pick', () => {
    expect(boot(`www.${site}`, {}, true)).toEqual(['dark']);
    expect(boot(`www.${site}`, { [key]: 'system' }, false)).toEqual([]);
  });
});

describe('the Explorer on livediagram and liveworkspace.app', () => {
  it("reads livediagram's key on livediagram's address", () => {
    expect(appearanceKeyForHost('www.livediagram.app')).toBe('livediagram:v2:ui-mode');
    expect(boot('www.livediagram.app', { 'livediagram:v2:ui-mode': 'dark' })).toEqual(['dark']);
  });

  it("falls back to the platform's key off every app's address", () => {
    for (const host of [
      'www.liveworkspace.app',
      'liveworkspace.app',
      'localhost:3000',
      'example.com',
    ]) {
      expect(appearanceKeyForHost(host)).toBe(PLATFORM_APPEARANCE_KEY);
      expect(
        boot(host, {
          [PLATFORM_APPEARANCE_KEY]: 'dark',
          [APP_APPEARANCE_KEYS.livehuddle]: 'light',
        }),
      ).toEqual(['dark']);
    }
  });
});

describe('the boot script', () => {
  it('survives storage being denied and a browser with no matchMedia', () => {
    expect(() =>
      runInlineScript(SCRIPT, {
        location: { host: 'www.liveplanner.app' },
        localStorage: {
          getItem: () => {
            throw new Error('denied');
          },
        },
        document: { documentElement: { classList: { add: () => {} } } },
      }),
    ).not.toThrow();
  });

  it('stays small, a lookup and one read before first paint', () => {
    expect(SCRIPT.length).toBeLessThan(1200);
  });

  it('comes from a module with no client boundary, so the server layout inlines the string', () => {
    const source = readFileSync(join(import.meta.dirname, 'appearance-keys.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('is the one the root layout inlines', () => {
    const layout = readFileSync(join(import.meta.dirname, '../../app/layout.tsx'), 'utf8');
    expect(layout).toContain('trustedConstant(siteAppearanceBootScript())');
    expect(layout).not.toContain('APPEARANCE_BOOT_SCRIPT');
  });
});
