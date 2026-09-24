import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The cascade utility (spec/141) carries a per-item animation-delay. The
// global reduced-motion rules collapse animation-duration but say nothing
// about delay, so without its own overrides a delayed row would sit
// invisible (backwards fill) for a beat nobody sees. Read the stylesheet
// the way dark-mode-coverage does: the rule is statable in words and there
// is no runtime that would notice it missing.
const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

function block(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `${selector} is defined`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('.stagger-enter', () => {
  it('delays by the item index and holds the keyframe start until then', () => {
    const rule = block('.stagger-enter {');
    // The beat is overridable per use (`--stagger-step`, the Toolbar strip
    // uses a quicker one) but keeps a fixed default for everyone else.
    expect(rule).toMatch(
      /animation-delay:\s*calc\(var\(--stagger-i, 0\) \* var\(--stagger-step, \d+ms\)\)/,
    );
    expect(rule).toContain('animation-fill-mode: backwards');
  });

  it('zeroes the delay for both reduced-motion routes', () => {
    // The OS setting...
    const media = css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .stagger-enter {');
    expect(media).toBeGreaterThan(-1);
    expect(css.slice(media, css.indexOf('}', media))).toContain('animation-delay: 0s !important');
    // ...and the per-user preference (spec/20).
    expect(block(':root.reduce-motion .stagger-enter {')).toContain(
      'animation-delay: 0s !important',
    );
  });
});
