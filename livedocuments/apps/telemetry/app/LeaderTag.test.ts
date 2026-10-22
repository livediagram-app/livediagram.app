import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colour-maths';

// Tailwind v4's emerald steps as sRGB hex (what axe measured in the browser): the tag's light-mode ink on its pill.
const EMERALD: Record<string, string> = { '50': '#ecfdf5', '600': '#009966', '700': '#007a55' };

describe('the leader tag', () => {
  it('reads at WCAG AA (4.5:1) in light mode at its 10px size', () => {
    const src = readFileSync(new URL('./LeaderTag.tsx', import.meta.url), 'utf8');
    const ink = / text-emerald-(\d+) /.exec(src)?.[1];
    const fill = / bg-emerald-(\d+) /.exec(src)?.[1];
    expect(ink && fill && EMERALD[ink] && EMERALD[fill]).toBeTruthy();
    expect(contrastRatio(EMERALD[ink!]!, EMERALD[fill!]!)).toBeGreaterThanOrEqual(4.5);
  });
});
