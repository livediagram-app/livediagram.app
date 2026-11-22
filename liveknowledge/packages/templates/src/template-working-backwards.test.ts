import { describe, expect, it } from 'vitest';
import { workingBackwardsOverrides } from './template-working-backwards';

// docs/specs/008-canvas/canvas-and-palette.md "Templates": the writing's headings never skip a level. The
// article draws its title as an h1 and Heading 1, 2 and 3 as h2, h3 and h4, so a Heading 2 straight after
// the title would read as an h3 under an h1.
const LEVEL: Record<string, number> = { title: 1, h1: 2, h2: 3, h3: 4 };

describe('the Working Backwards template', () => {
  it('never skips a heading level', () => {
    const o = workingBackwardsOverrides();
    const blocks = Object.values(o.articles!)[0]!.blocks;
    let previous = 0;
    const seen: number[] = [];
    for (const b of blocks) {
      if (b.type !== 'paragraph' || !LEVEL[b.style ?? '']) continue;
      const level = LEVEL[b.style!]!;
      expect(level, `${b.style} after level ${previous}`).toBeLessThanOrEqual(previous + 1);
      previous = level;
      seen.push(level);
    }
    expect(seen[0]).toBe(1);
    expect(seen).toContain(3);
  });
});
