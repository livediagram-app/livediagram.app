import { describe, expect, it } from 'vitest';
import { newPageBackgroundLabel } from './new-page-background';
import { gradientFill, PAGE_GRADIENT_PRESETS, themeBackgroundPresets } from './page-paint';
import { getTheme } from './themes';

// docs/specs/011-theme/canvas-and-theme-dialog.md "New Page Background": the Fine-tune row names the tab's choice by
// this editor's theme backgrounds and gradient presets.
describe('newPageBackgroundLabel', () => {
  const presets = themeBackgroundPresets(getTheme('brand'));

  it('reads "Like the page before" without a choice, and plain paper as Paper', () => {
    expect(newPageBackgroundLabel(undefined, presets)).toBe('Like the page before');
    expect(newPageBackgroundLabel({}, presets)).toBe('Paper');
  });

  it("names a theme background by its preset's label, with its pattern", () => {
    const preset = presets[0]!;
    expect(newPageBackgroundLabel({ fill: preset.fill, pattern: 'dots' }, presets)).toBe(
      `${preset.label}, dots`,
    );
  });

  it('names a gradient preset, and an unnamed solid as Solid colour', () => {
    const sunrise = PAGE_GRADIENT_PRESETS[0]!;
    expect(newPageBackgroundLabel({ fill: gradientFill(sunrise) }, [])).toBe(sunrise.label);
    expect(newPageBackgroundLabel({ fill: { kind: 'solid', color: '#123456' } }, [])).toBe(
      'Solid colour',
    );
  });
});
