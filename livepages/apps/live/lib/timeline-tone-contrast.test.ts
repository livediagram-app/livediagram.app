import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@livepages/document';
import { toneColor } from '@livepages/ui';

// docs/specs/013-workspace/timeline.md "Colour": a tone's bold value labels a card's reason in 12 px text on the white
// card, so in light mode it reads at 4.5:1 there (amber and emerald 600 fell short, 3.2:1 and 3.8:1), and paints the
// glyph on its own soft tint, a non-text mark at 3:1.
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const root = css.slice(
  css.indexOf(':root {\n  --ld-timeline-danger'),
  css.indexOf('}', css.indexOf(':root {\n  --ld-timeline-danger')),
);
const varOf = (name: string) =>
  new RegExp(`--ld-timeline-${name}: (#[0-9a-f]{6});`).exec(root)![1]!;
const softOf = (name: string) => {
  const [r, g, b, a] = new RegExp(
    `--ld-timeline-${name}-soft: rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\);`,
  )
    .exec(root)!
    .slice(1)
    .map(Number);
  const mix = (c: number) => Math.round(c * a! + 255 * (1 - a!));
  return `#${[mix(r!), mix(g!), mix(b!)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

describe('timeline tones in light mode', () => {
  it.each(['danger', 'structural', 'create', 'neutral'])(
    '%s reads at AA on white, its glyph at 3:1 on its tint',
    (tone) => {
      expect(contrastRatio(varOf(tone), '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(varOf(tone), softOf(tone))).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the package fallbacks equal to the app values', () => {
    for (const tone of ['danger', 'structural', 'create', 'neutral'] as const)
      expect(toneColor(tone)).toBe(`var(--ld-timeline-${tone}, ${varOf(tone)})`);
  });
});
