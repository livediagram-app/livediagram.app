import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The touch-target utilities (docs/specs/004-interface-design/touch-targets.md "How").
const THEME_CSS = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
const utility = (name: string) =>
  new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}`).exec(THEME_CSS)?.[1] ?? '';

describe('touch-target-packed', () => {
  const rule = utility('touch-target-packed');

  it('pads to 44px both ways, only on a coarse pointer', () => {
    expect(rule).toMatch(/@media \(pointer: coarse\)/);
    expect(rule).toMatch(/content:\s*'';/);
    expect(rule).toMatch(/position:\s*absolute;/);
    expect(rule).toMatch(/inset:\s*min\(0px, calc\(50% - 22px\)\);/);
  });

  it('draws the pad behind the controls, so a drawn tile always wins its own box', () => {
    expect(rule).toMatch(/z-index:\s*-1;/);
  });
});

describe('touch-target-y', () => {
  it('stays vertical only, for rows whose popovers a stacking context would trap', () => {
    const rule = utility('touch-target-y');
    expect(rule).toMatch(/inset-inline:\s*0;/);
    expect(rule).not.toMatch(/z-index/);
  });
});
