import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { HERO_GROUNDS, HERO_INK_CONTRAST, resolveHeroTokens } from '@liveworkspace/ui/dialog-hero';
import { editorAccentCss } from './editor-accent';

// A themed tab retints the brand ramp and the dark surfaces under body-portaled dialogs too, so a dialog's hero header
// (liveworkspace/docs/specs/004-index/dialog-hero-header.md "Colour") wears the tab's accent: its title and line must
// still read at AA there, for pale, loud and dark accents alike.
const ACCENTS = [
  '#15803d',
  '#dc2626',
  '#ca8a04',
  '#f59e0b',
  '#0891b2',
  '#db2777',
  '#4f46e5',
  '#fde047',
  '#111827',
];

// The untinted slate stops the header's words use (Tailwind's hex fallbacks).
const SLATE = { 100: '#f1f5f9', 400: '#90a1b9', 600: '#45556c', 900: '#0f172b' };

function ramp(block: string, name: string): Record<number, string> {
  return Object.fromEntries(
    [...block.matchAll(new RegExp(`--color-${name}-(\\d+):(#[0-9a-f]{6});`, 'g'))].map(
      (m): [number, string] => [Number(m[1]), m[2]!],
    ),
  );
}

describe.each(ACCENTS)('a tab themed %s', (accent) => {
  const css = editorAccentCss(accent);
  const [root, dark] = css.split('html.dark');
  const brand = ramp(root!, 'brand');
  const darkSlate = { ...SLATE, ...ramp(dark!, 'slate') };

  it.each([
    ['light', SLATE],
    ['dark', darkSlate],
  ] as const)('keeps the hero header’s words at AA, %s', (mode, slate) => {
    const t = resolveHeroTokens(mode, brand, slate);
    for (const ground of HERO_GROUNDS) {
      expect(contrastRatio(t.ink, t[ground])).toBeGreaterThanOrEqual(HERO_INK_CONTRAST);
      expect(contrastRatio(t.muted, t[ground])).toBeGreaterThanOrEqual(HERO_INK_CONTRAST);
    }
  });
});
