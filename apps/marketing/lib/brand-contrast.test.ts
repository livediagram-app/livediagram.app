import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The brand colours marketing writes small text in, and puts white text on, must meet WCAG 2.2 AA (4.5:1)
// in light and in dark (docs/specs/019-marketing/marketing-site.md "Tone & brand"). sky-500 and sky-600
// read at 2.8:1 and 4.1:1 against white, so the CTA panels and small brand text use brand-700.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const THEME = read('../../../packages/tailwind-config/theme.css');

// The palette as declared: the light tokens from the theme block, the dark overrides from `.dark`.
function palette(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--color-((?:brand|slate)-\d+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1]!,
      m[2]!,
    ]),
  );
}
const darkStart = THEME.indexOf('.dark {');
const LIGHT: Record<string, string> = {
  ...palette(THEME.slice(0, darkStart)),
  white: '#ffffff',
  'slate-50': '#f8fafc',
};
const DARK: Record<string, string> = {
  ...LIGHT,
  ...palette(THEME.slice(darkStart, THEME.indexOf('}', darkStart))),
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('brand text contrast', () => {
  // [text, background] pairs marketing actually renders small text in.
  const LIGHT_PAIRS = [
    ['white', 'brand-700'], // CTA panel heading and button-adjacent copy
    ['brand-50', 'brand-700'], // CTA panel body
    ['brand-700', 'white'], // eyebrows, FAQ links, "Learn more"
    ['brand-700', 'slate-50'],
  ] as const;
  const DARK_PAIRS = [
    ['white', 'brand-700'],
    ['brand-50', 'brand-700'],
    ['brand-300', 'slate-950'],
    ['brand-300', 'slate-900'],
  ] as const;

  it.each(LIGHT_PAIRS)('light: %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(LIGHT[fg]!, LIGHT[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(DARK_PAIRS)('dark: %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(DARK[fg]!, DARK[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the CTA panels, eyebrows and FAQ links on those pairs', () => {
    expect(read('../components/StartDrawingCta.tsx')).toMatch(/bg-brand-700 .*dark:bg-brand-700/);
    expect(read('../components/TryItCard.tsx')).toMatch(/bg-brand-700 .*dark:bg-brand-700/);
    expect(read('../components/band-classes.ts')).toContain('text-brand-700');
    expect(read('../components/faq/FaqItem.tsx')).toContain('[&_a]:text-brand-700');
  });
});
