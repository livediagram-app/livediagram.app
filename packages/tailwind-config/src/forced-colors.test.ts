import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/specs/004-interface-design/forced-colors.md: under a Windows contrast theme, a control whose chosen state is
// only its fill shows it with the system's selection colours, and a switch keeps its own colours.

const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');

/** The `@media (forced-colors: active)` block, found by brace matching. */
function forcedBlock(): string {
  const at = css.indexOf('@media (forced-colors: active)');
  expect(at).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  throw new Error('unbalanced forced-colors block');
}

/** Whether a block opened before `offset` and still open there is an `@layer`. Comments are blanked first. */
function insideLayer(offset: number): boolean {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
  const stack: boolean[] = [];
  let head = 0;
  for (let i = 0; i < offset; i++) {
    if (code[i] === '{') {
      stack.push(/^\s*@layer\b/.test(code.slice(head, i)));
      head = i + 1;
    } else if (code[i] === '}' || code[i] === ';') {
      if (code[i] === '}') stack.pop();
      head = i + 1;
    }
  }
  return stack.includes(true);
}

describe('forced colours', () => {
  it('rings a checked, pressed or selected control in Highlight, except under its focus ring', () => {
    const block = forcedBlock();
    for (const state of [
      "[role='radio'], [role='menuitemradio'])[aria-checked='true']",
      "[aria-pressed='true']",
      "[role='tab'], [role='option'])[aria-selected='true']",
      "[data-tab-key][aria-current='page']",
    ])
      expect(block).toContain(state);
    expect(block).toContain(':not(:focus-visible)');
    expect(block).toMatch(/outline:\s*2px solid Highlight;/);
    // Never a fill: the browser's Canvas backplate behind forced text hid a filled option's label.
    expect(block).not.toMatch(/background-color:\s*Highlight/);
  });

  it('keeps a switch in its own colours', () => {
    expect(forcedBlock()).toMatch(/\[role='switch'\]\s*\{\s*forced-color-adjust:\s*none;/);
  });

  // Inside a layer it would lose to the utility painting the state (`bg-brand-50`), which the browser repaints as
  // Canvas: the very state it exists to show.
  it('sits outside every layer, so the utilities that paint the state do not outrank it', () => {
    expect(insideLayer(css.indexOf('@media (forced-colors: active)'))).toBe(false);
    // The check itself sees a layer: the focus ring's base layer.
    expect(insideLayer(css.indexOf(':is(button, a, summary'))).toBe(true);
  });
});
