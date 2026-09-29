import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The cascade utility (docs/specs/006-document/save-locations.md) carries a per-item animation-delay. The
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
  it('delays by the item index, capped, and holds the keyframe start until then', () => {
    const rule = block('.stagger-enter {').replace(/\s+/g, ' ');
    // The beat and its cap are the shared cascade tokens, so a cascade of any
    // length settles within the 250ms motion budget
    // (docs/specs/004-interface-design/motion.md).
    expect(rule).toContain(
      'animation-delay: min( calc(var(--stagger-i, 0) * var(--motion-cascade-step)), var(--motion-cascade-cap) );',
    );
    expect(rule).toContain('animation-fill-mode: backwards');
  });

  it('zeroes the delay for both reduced-motion routes', () => {
    // The OS setting...
    const media = css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .stagger-enter {');
    expect(media).toBeGreaterThan(-1);
    expect(css.slice(media, css.indexOf('}', media))).toContain('animation-delay: 0s !important');
    // ...and the per-user preference (docs/specs/007-editor/user-preferences.md).
    expect(block(':root.reduce-motion .stagger-enter {')).toContain(
      'animation-delay: 0s !important',
    );
  });
});
