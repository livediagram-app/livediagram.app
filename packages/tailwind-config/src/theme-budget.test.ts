import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MOTION_TOKENS,
  formatViolations,
  scanStylesheet,
} from '@liveworkspace/style-guards/motion-budget';

const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');

// Every product's palette over this theme: <product>/packages/tailwind-config/theme.css in the monorepo.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const bindings = readdirSync(repo)
  .map((product) => ({ product, path: join(repo, product, 'packages/tailwind-config/theme.css') }))
  .filter(({ path }) => existsSync(path))
  .map(({ product, path }) => ({ product, css: readFileSync(path, 'utf8') }));

// The shared theme is chrome for every app that imports it
// (docs/specs/004-interface-design/motion.md), so it is held to the budget itself, and so is every palette over it.
describe('shared theme motion', () => {
  it('keeps every chrome duration within the budget', () => {
    expect(formatViolations(scanStylesheet(theme, 'theme.css', MOTION_TOKENS))).toBe('');
    for (const { product, css } of bindings) {
      expect(formatViolations(scanStylesheet(css, `${product} theme.css`, MOTION_TOKENS))).toBe('');
    }
  });
});

/** The `--color-brand-*` / `--color-slate-*` declarations of the first top-level `selector` block of `css`. */
function vars(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) return {};
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries(
    [...body.matchAll(/--color-((?:brand|slate)-\d+):\s*([^;]+);/g)].map((m): [string, string] => [
      m[1]!,
      m[2]!,
    ]),
  );
}
const brandOf = (v: Record<string, string>) =>
  Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('brand-')));

// The editor's header, tab bar and logo keep the app's own colours whatever the tab's style
// (docs/specs/011-theme/canvas-and-theme-dialog.md "The app's chrome"): their block re-declares the palettes, so it
// must stay equal to them.
describe('app chrome palette', () => {
  it('re-declares the light brand ramp as @theme sets it', () => {
    expect(vars(theme, '[data-app-chrome]')).toEqual(brandOf(vars(theme, '@theme')));
  });

  it('re-declares the dark brand ramp and surfaces as .dark sets them', () => {
    const chrome = vars(theme, '.dark [data-app-chrome]');
    const dark = vars(theme, '.dark');
    expect(brandOf(chrome)).toEqual(brandOf(dark));
    for (const [k, v] of Object.entries(dark))
      if (k.startsWith('slate-')) expect(chrome[k]).toBe(v);
    expect(
      Object.keys(chrome)
        .filter((k) => k.startsWith('slate-'))
        .sort(),
    ).toEqual(['slate-600', 'slate-700', 'slate-800', 'slate-900', 'slate-950']);
  });
});

// A product's palette (docs/specs/004-interface-design/color-scheme.md there) is its brand ramps and nothing else:
// the shared theme first, then every block that paints a brand ramp, re-declared in full in the product's accent.
const BRAND_BLOCKS = [
  '@theme',
  '.dark',
  '[data-app-chrome]',
  '.dark [data-app-chrome]',
  ".dark[data-palette='midnight']",
];
const STOPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

describe.each(bindings)('$product palette', ({ css }) => {
  it('imports the shared theme before anything else', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toMatch(
      /^@import '@liveworkspace\/tailwind-config\/theme\.css';/,
    );
  });

  it('re-declares every brand stop of every block the shared theme paints its ramp in', () => {
    for (const selector of BRAND_BLOCKS) {
      expect(vars(theme, selector), `shared ${selector}`).toHaveProperty('brand-500');
      expect(Object.keys(vars(css, selector)).sort(), selector).toEqual(
        STOPS.map((s) => `brand-${s}`).sort(),
      );
    }
  });

  it('keeps the chrome equal to its ramps, light and dark', () => {
    expect(vars(css, '[data-app-chrome]')).toEqual(vars(css, '@theme'));
    expect(vars(css, '.dark [data-app-chrome]')).toEqual(vars(css, '.dark'));
  });

  it('declares only brand ramps, so nothing else drifts from the shared theme', () => {
    const declarations = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:/g)];
    expect(
      declarations.map((m) => m[1]).filter((name) => !/^--color-brand-\d+$/.test(name!)),
    ).toEqual([]);
  });
});

it('finds the products’ palettes', () => {
  expect(bindings.map((b) => b.product).sort()).toEqual([
    'livedesign',
    'livedocuments',
    'liveplanner',
  ]);
});
