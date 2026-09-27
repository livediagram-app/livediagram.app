import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// In dark appearance the mock-ups show the editor as it looks in dark
// (docs/specs/004-interface-design/appearance.md): a Default-scheme canvas is the scheme's dark
// half and an unpainted element wears its dark ink. The art keeps those values as CSS custom
// properties, so these read the sources and hold them to the editor's own constants rather than
// letting a copy drift.

const APP = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${APP}${path}`, 'utf8');

function tsConstant(source: string, name: string): string {
  const match = source.match(new RegExp(`${name} = '(#[0-9a-f]{6})'`));
  if (!match?.[1]) throw new Error(`${name} not found`);
  return match[1];
}

function darkInk(source: string, key: 'fill' | 'stroke' | 'text'): string {
  const block = source.match(/const DARK_INK = \{([\s\S]*?)\}/)?.[1] ?? '';
  const match = block.match(new RegExp(`${key}: '(#[0-9a-f]{6})'`));
  if (!match?.[1]) throw new Error(`DARK_INK.${key} not found`);
  return match[1];
}

function artProperty(css: string, name: string): string {
  const block = css.match(/(?:^|\n)\.dark \{([\s\S]*?)\}/)?.[1] ?? '';
  const match = block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
  if (!match?.[1]) throw new Error(`--${name} not set under .dark`);
  return match[1];
}

describe('dark mock-up palette', () => {
  const css = read('app/hero-animations.css');
  const canvas = read('../../packages/diagram/src/canvas-colors.ts');
  const colours = read('../../packages/diagram/src/colors.ts');

  it('paints the Default scheme dark half on the canvas', () => {
    expect(artProperty(css, 'art-paper')).toBe(tsConstant(canvas, 'DARK_CANVAS_BACKGROUND_COLOR'));
    expect(artProperty(css, 'art-grid')).toBe(tsConstant(canvas, 'DARK_CANVAS_PATTERN_COLOR'));
  });

  it('draws unpainted elements in the dark ink', () => {
    expect(artProperty(css, 'art-ink-fill')).toBe(darkInk(colours, 'fill'));
    expect(artProperty(css, 'art-ink-stroke')).toBe(darkInk(colours, 'stroke'));
    expect(artProperty(css, 'art-ink-text')).toBe(darkInk(colours, 'text'));
  });
});

describe('hero window veil', () => {
  it('fades to the dark page colour in dark appearance', () => {
    const pageDark = read('app/layout.tsx').match(/<body[^>]*\b(dark:bg-slate-\d+)/)?.[1];
    const veil = read('components/HeroIllustration.tsx').match(
      /className=\{`pointer-events-none absolute inset-0 z-20 ([^`$]*)/,
    )?.[1];
    expect(pageDark).toBeTruthy();
    expect(veil?.split(' ')).toContain(pageDark);
  });
});
