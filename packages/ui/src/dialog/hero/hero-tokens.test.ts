import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import {
  HERO_GROUNDS,
  HERO_INK_CONTRAST,
  HERO_TOKENS,
  HERO_TOKEN_STYLE,
  heroVar,
  resolveHeroTokens,
  type HeroRamp,
} from './hero-tokens';

// liveworkspace/docs/specs/004-index/dialog-hero-header.md "Colour": the title and its line read at WCAG AA on every
// ground of the band, light and dark, in every product's brand ramp, wherever a dialog can open (each product's
// editor, and liveworkspace.app's Explorer wearing the app a person came from).

const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const shared = readFileSync(join(repo, 'packages/tailwind-config/theme.css'), 'utf8');

/** The `--color-<ramp>-<stop>` hex declarations of the first block whose selector starts `selector`. */
function stops(css: string, selector: string, ramp: 'brand' | 'slate'): Record<number, string> {
  const at = css.indexOf(selector);
  if (at < 0) return {};
  const start = css.indexOf('{', at);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(new RegExp(`--color-${ramp}-(\\d+):\\s*(#[0-9a-fA-F]{6});`, 'g'))].map(
      (m): [number, string] => [Number(m[1]), m[2]!.toLowerCase()],
    ),
  );
}

// Tailwind's own slate, where no theme re-declares it (its hex fallbacks), under the dark theme's own surfaces.
const TAILWIND_SLATE: HeroRamp = { 100: '#f1f5f9', 400: '#90a1b9', 600: '#45556c', 900: '#0f172b' };
const LIGHT_SLATE = TAILWIND_SLATE;
const DARK_SLATE: HeroRamp = { ...TAILWIND_SLATE, ...stops(shared, '\n.dark {', 'slate') };

type Case = { name: string; light: HeroRamp; dark: HeroRamp };

// Every product's ramps: the shared theme's (livediagram and liveworkspace.app), then each product's re-declaration.
const products: Case[] = [
  {
    name: 'platform',
    light: stops(shared, '\n@theme {', 'brand'),
    dark: stops(shared, '\n.dark {', 'brand'),
  },
  ...readdirSync(repo)
    .map((product) => ({
      product,
      path: join(repo, product, 'packages/tailwind-config/theme.css'),
    }))
    .filter(({ path }) => existsSync(path))
    .map(({ product, path }) => {
      const css = readFileSync(path, 'utf8');
      return {
        name: product,
        light: stops(css, '\n@theme {', 'brand'),
        dark: stops(css, '\n.dark {', 'brand'),
      };
    }),
];

// liveworkspace.app wears the app a person came from (app/app-colours.css).
const site = readFileSync(join(repo, 'liveworkspace/apps/site/app/app-colours.css'), 'utf8');
const siteApps: Case[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
].map((app) => ({
  name: `liveworkspace.app as ${app}`,
  light: stops(site, `\n[data-explorer-app='${app}'],`, 'brand'),
  dark: stops(site, `\n.dark [data-explorer-app='${app}'],`, 'brand'),
}));

describe('the hero header’s colours', () => {
  it('finds every product’s ramps, light and dark', () => {
    expect(products.map((p) => p.name).sort()).toEqual([
      'livedesign',
      'livedocuments',
      'livehuddle',
      'liveplanner',
      'platform',
    ]);
    for (const { name, light, dark } of [...products, ...siteApps]) {
      expect(Object.keys(light), name).toHaveLength(11);
      expect(Object.keys(dark), name).toHaveLength(11);
    }
    expect(DARK_SLATE[900]).toBe('#131b26');
  });

  describe.each([...products, ...siteApps])('$name', ({ light, dark }) => {
    it.each([
      ['light', light, LIGHT_SLATE],
      ['dark', dark, DARK_SLATE],
    ] as const)('reads the title and its line at AA on every ground, %s', (mode, brand, slate) => {
      const t = resolveHeroTokens(mode, brand, slate);
      for (const ground of HERO_GROUNDS) {
        expect(contrastRatio(t.ink, t[ground]), `ink on ${ground}`).toBeGreaterThanOrEqual(
          HERO_INK_CONTRAST,
        );
        expect(contrastRatio(t.muted, t[ground]), `muted on ${ground}`).toBeGreaterThanOrEqual(
          HERO_INK_CONTRAST,
        );
      }
      // The band reads as a band: the paper is tinted, and the accent stands off it as a mark should (3:1).
      expect(t.paper).not.toBe(mode === 'light' ? '#ffffff' : slate[900]);
      expect(contrastRatio(t.accent, t.wash)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('the tokens as CSS', () => {
  it('writes every token as a light-dark() pair of sRGB mixes over the dialog’s ground', () => {
    const style = HERO_TOKEN_STYLE as Record<string, string>;
    expect(Object.keys(style).sort()).toEqual(
      Object.keys(HERO_TOKENS)
        .map((name) => `--hero-${name}`)
        .sort(),
    );
    expect(style['--hero-paper']).toBe(
      'light-dark(color-mix(in srgb, var(--color-brand-600) 6%, white), color-mix(in srgb, var(--color-brand-400) 10%, var(--color-slate-900)))',
    );
    expect(style['--hero-accent']).toBe(
      'light-dark(var(--color-brand-600), var(--color-brand-400))',
    );
    expect(style['--hero-plate']).toBe(
      'light-dark(white, color-mix(in srgb, var(--color-slate-100) 10%, var(--color-slate-900)))',
    );
    expect(style['--hero-ink']).toBe('light-dark(var(--color-slate-900), var(--color-slate-100))');
    expect(heroVar('wash')).toBe('var(--hero-wash)');
  });

  it('mixes as the browser does, channel by channel in sRGB', () => {
    const t = resolveHeroTokens('light', { 600: '#000000' }, LIGHT_SLATE);
    // 6% black into white.
    expect(t.paper).toBe('#f0f0f0');
    expect(t.accent).toBe('#000000');
    expect(t.plate).toBe('#ffffff');
    const d = resolveHeroTokens('dark', { 400: '#ffffff' }, { ...DARK_SLATE, 900: '#000000' });
    expect(d.paper).toBe('#1a1a1a');
    expect(d.plate).toBe(
      resolveHeroTokens('dark', { 400: '#000000' }, { ...DARK_SLATE, 900: '#000000' }).plate,
    );
  });
});
