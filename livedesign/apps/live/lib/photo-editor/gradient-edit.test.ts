import { describe, expect, it } from 'vitest';
import type { Gradient } from '@livedesign/photo-engine';
import { gradientCss, gradientPresets, movedStop, withoutStop, withStop } from './gradient-edit';

// docs/specs/031-photo/photo-tools.md "Fills and gradients": the gradient editor's stops and presets.
const bw: Gradient = {
  colours: [
    { at: 0, colour: '#000000' },
    { at: 1, colour: '#ffffff' },
  ],
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 0 },
  ],
};

describe('the gradient editor', () => {
  it('offers the nine presets, the first three from the colours in hand', () => {
    const presets = gradientPresets('#112233', '#445566');
    expect(presets.map((p) => p.name)).toEqual([
      'Foreground to Background',
      'Foreground to Transparent',
      'Black to White',
      'Spectrum',
      'Sunset',
      'Ocean',
      'Copper',
      'Violet to Orange',
      'Chrome',
    ]);
    expect(presets[0]!.gradient.colours.map((s) => s.colour)).toEqual(['#112233', '#445566']);
    expect(presets[1]!.gradient.opacities.map((s) => s.opacity)).toEqual([1, 0]);
    for (const p of presets) {
      expect(p.gradient.colours[0]!.at).toBe(0);
      expect(p.gradient.colours.at(-1)!.at).toBe(1);
    }
  });

  it('adds a stop that takes what the gradient has there, kept in order', () => {
    const c = withStop(bw, 'colour', 0.5);
    expect(c.index).toBe(1);
    expect(c.gradient.colours[1]).toEqual({ at: 0.5, colour: '#808080' });
    const o = withStop(bw, 'opacity', 0.25);
    expect(o.gradient.opacities[o.index]).toEqual({ at: 0.25, opacity: 0.75 });
    expect(withStop(bw, 'colour', 3).gradient.colours.at(-1)!.at).toBe(1);
  });

  it('moves a stop past another and answers where it went', () => {
    const three = withStop(bw, 'colour', 0.5).gradient;
    const moved = movedStop(three, 'colour', 0, 0.75, { colour: '#ff0000' });
    expect(moved.gradient.colours.map((s) => s.at)).toEqual([0.5, 0.75, 1]);
    expect(moved.index).toBe(1);
    expect(moved.gradient.colours[1]!.colour).toBe('#ff0000');
    const faded = movedStop(bw, 'opacity', 1, 1, { opacity: 2 });
    expect(faded.gradient.opacities[1]!.opacity).toBe(1);
  });

  it('removes a stop, but never the last of its kind', () => {
    expect(withoutStop(bw, 'colour', 0).colours).toEqual([{ at: 1, colour: '#ffffff' }]);
    const one = withoutStop(bw, 'opacity', 1);
    expect(withoutStop(one, 'opacity', 0)).toBe(one);
  });

  it('draws as CSS sampled at every stop, reversed when asked', () => {
    expect(gradientCss(bw)).toBe(
      'linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(255, 255, 255, 0) 100%)',
    );
    expect(gradientCss(bw, true)).toBe(
      'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(0, 0, 0, 1) 100%)',
    );
  });
});
