import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_APPS, type BrandApp } from './apps';

// Where each app's light brand ramp is declared: livediagram's sky is the shared theme's own, every other product's
// palette re-declares it over that theme (each product's docs/specs/004-interface-design/color-scheme.md). livehuddle,
// registered before its fork, has no theme yet: its ramp is Tailwind's emerald, checked below, until the fork's
// tailwind-config joins this list.
const THEME_CSS: Partial<Record<BrandApp, string>> = {
  livediagram: '../../tailwind-config/theme.css',
  liveplanner: '../../../liveplanner/packages/tailwind-config/theme.css',
  livedocuments: '../../../livedocuments/packages/tailwind-config/theme.css',
  livedesign: '../../../livedesign/packages/tailwind-config/theme.css',
};

/** The `--color-brand-*` declarations of the stylesheet's `@theme` block, keyed by step. */
function lightRamp(css: string): Record<string, string> {
  const start = css.indexOf('\n@theme {');
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries(
    [...body.matchAll(/--color-brand-(\d+):\s*([^;]+);/g)].map((m): [string, string] => [
      m[1]!,
      m[2]!.trim(),
    ]),
  );
}

describe('BRAND_APPS ramp', () => {
  it.each(Object.keys(THEME_CSS) as BrandApp[])('is the %s theme’s light brand ramp', (app) => {
    const declared = lightRamp(readFileSync(new URL(THEME_CSS[app]!, import.meta.url), 'utf8'));
    expect(Object.keys(declared)).toHaveLength(11);
    expect(BRAND_APPS[app].ramp).toEqual(declared);
  });
});

describe('livehuddle', () => {
  it('is emerald: accent 500, deep 700 and light 400 as the site row has them (open decisions D5)', () => {
    const { ramp, lockup, palettes } = BRAND_APPS.livehuddle;
    expect([ramp[500], ramp[700], ramp[400]]).toEqual(['#10b981', '#047857', '#34d399']);
    expect(lockup.light.accent).toBe(ramp[700]);
    expect(lockup.dark.accent).toBe(ramp[400]);
    expect(palettes.dark.vivid).toBe(ramp[500]);
  });
});
