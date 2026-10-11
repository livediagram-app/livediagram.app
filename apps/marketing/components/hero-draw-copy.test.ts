import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRAW_COPY, HAND_GLYPHS } from './hero-draw-copy';

const FONT = join(__dirname, '..', 'public', 'fonts', 'caveat-hero.woff2');
// The subset's budget: it loads with the hero (the overview draws the Draw scene on first paint).
const FONT_BUDGET_BYTES = 20 * 1024;

function used(): Set<string> {
  const chars = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') for (const c of v) chars.add(c);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(DRAW_COPY);
  return chars;
}

// The Draw window writes in a hand face subset to HAND_GLYPHS (hero-draw-copy.ts): a glyph the
// subset lacks would fall back to a system face mid-word, and one it carries but no word uses is
// font weight for nothing.
describe('the Draw window hand face', () => {
  it('carries every character the copy writes', () => {
    const missing = [...used()].filter((c) => !HAND_GLYPHS.includes(c));
    expect(missing).toEqual([]);
  });

  it('carries no character the copy does not write', () => {
    const chars = used();
    expect([...HAND_GLYPHS].filter((c) => !chars.has(c))).toEqual([]);
  });

  it('stays inside its byte budget', () => {
    expect(statSync(FONT).size).toBeLessThan(FONT_BUDGET_BYTES);
    expect(readFileSync(FONT).subarray(0, 4).toString('latin1')).toBe('wOF2');
  });
});
