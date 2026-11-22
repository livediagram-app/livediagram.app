import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Reduced motion (docs/specs/004-interface-design/motion.md "Reduced motion"): both the OS
// setting and the per-user preference collapse motion to instant.
//
// Transitions collapse to 0s, not 0.01ms. Every element's transition-property
// defaults to `all`, so a non-zero duration on `*` turned EVERY style write in
// the editor into a transition: a position written and measured in the same
// frame read back the old value. The tab menu's viewport clamp then nudged
// again, forever ("Maximum update depth exceeded"). Animations only run where
// one is declared, so they keep 0.01ms and their animationend still fires
// (PresentationHost waits on it).
const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

function collapse(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `${selector} is defined`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('reduced motion collapse', () => {
  for (const [route, selector] of [
    ['the OS setting', '@media (prefers-reduced-motion: reduce) {\n  *,'],
    ['the Reduce motion preference', ':root.reduce-motion *,'],
  ] as const) {
    it(`creates no transitions under ${route}`, () => {
      expect(collapse(selector)).toContain('transition-duration: 0s !important;');
    });

    it(`keeps animations firing animationend under ${route}`, () => {
      const rule = collapse(selector);
      expect(rule).toContain('animation-duration: 0.01ms !important;');
      expect(rule).toContain('animation-iteration-count: 1 !important;');
    });
  }
});
