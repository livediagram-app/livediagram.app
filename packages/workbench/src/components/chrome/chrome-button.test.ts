import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { CHROME_BTN } from './chrome-button';
import { TAB_BAR_CLASS } from './tab-shape';

// The bar's controls label themselves in small text (12 px) beside their icons, on the tab bar's own surface, so
// their resting ink reads at WCAG AA there (4.5:1, docs/specs/004-interface-design/color-scheme.md). Tailwind's slate
// ramp as the browser paints it (v4's oklch, in hex).
const SLATE: Record<string, string> = {
  '100': '#f1f5f9',
  '200': '#e2e8f0',
  '300': '#cad5e2',
  '400': '#90a1b9',
  '500': '#62748e',
  '600': '#45556c',
  '700': '#314158',
  '800': '#1d293d',
  '950': '#020618',
};

// The first bare (light, resting) `<prefix>-slate-N` in a class string, as its hex.
function slate(classes: string, prefix: 'text' | 'bg', variant = ''): string {
  const want = `${variant}${prefix}-slate-`;
  const cls = classes.split(/\s+/).find((c) => c.startsWith(want));
  const hex = cls ? SLATE[cls.slice(want.length)] : undefined;
  if (!hex) throw new Error(`no ${want}N in ${classes}`);
  return hex;
}

describe('the bar control', () => {
  it('reads at AA on the tab bar it sits on, light and dark', () => {
    expect(
      contrastRatio(slate(CHROME_BTN, 'text'), slate(TAB_BAR_CLASS, 'bg')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(slate(CHROME_BTN, 'text', 'dark:'), slate(TAB_BAR_CLASS, 'bg', 'dark:')),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
