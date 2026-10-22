import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { planPalette } from './plan-palette';
import {
  PLAN_PRESET_HUES,
  isPlanPresetId,
  planColorPresets,
  planPresetColours,
} from './plan-presets';

// docs/specs/010-palette/style-presets.md "Boards and sheets".
describe('board and sheet presets', () => {
  it.each(['light', 'dark'] as const)(
    'every preset keeps readable ink on a %s surface',
    (surface) => {
      for (const p of planColorPresets(surface)) {
        expect(contrastRatio(p.text, p.fill), p.id).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('is calm: a light fill stays light and a dark fill stays dark', () => {
    for (const { id } of PLAN_PRESET_HUES) {
      expect(contrastRatio(planPresetColours(id, 'light')!.fill, '#ffffff')).toBeLessThan(1.15);
      expect(contrastRatio(planPresetColours(id, 'dark')!.fill, '#111827')).toBeLessThan(1.4);
    }
  });

  it('draws a stored preset for the surface it is on, over the colours it wrote', () => {
    const own = { fill: '#ffffff', stroke: '#000000', text: '#000000', preset: 'plan-sky' };
    expect(planPalette('dark', own).surface).toBe(planPresetColours('plan-sky', 'dark')!.fill);
    expect(planPalette('light', own).surface).toBe(planPresetColours('plan-sky', 'light')!.fill);
  });

  it('leaves an element with a shape preset, or none, to its own colours', () => {
    expect(planPalette('light', { fill: '#fef3c7', preset: 'warning' }).surface).toBe('#fef3c7');
    expect(planPresetColours('solid', 'light')).toBeNull();
    expect(isPlanPresetId('plan-sage')).toBe(true);
    expect(isPlanPresetId('sage')).toBe(false);
  });
});
