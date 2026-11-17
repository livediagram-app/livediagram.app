import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { FURNITURE_LIGHT, partShade, rgbaOf, shadeKeys, tone } from './furniture-shading';
import { ellipse, path, rect } from './furniture-art';

// docs/specs/009-elements/furniture-art-style.md "Light".
describe('the furniture light', () => {
  it('reads hex, eight-digit hex, rgb(), rgba() and names', () => {
    expect(rgbaOf('#ff8000')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(rgbaOf('#ff800080')).toEqual({ r: 255, g: 128, b: 0, a: 128 / 255 });
    expect(rgbaOf('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(rgbaOf('rgba(1, 2, 3, 0.32)')).toEqual({ r: 1, g: 2, b: 3, a: 0.32 });
    expect(rgbaOf('rgb(1 2 3 / 50%)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(rgbaOf('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(rgbaOf('url(#x)')).toBeNull();
  });

  it('moves a colour toward white or black, keeping its alpha', () => {
    expect(tone('#000000', 0.5)).toBe('#808080');
    expect(tone('#ffffff', -0.5)).toBe('#808080');
    expect(tone('#336699', 0)).toBe('#336699');
    expect(tone('rgba(0, 0, 0, 0.5)', 1)).toBe('#ffffff80');
    expect(tone('url(#x)', 0.5)).toBe('url(#x)');
  });

  it('lights a top surface and shades a face, each edged in its own deeper shade', () => {
    const panel = partShade('#808080', 'panel');
    const face = partShade('#808080', 'face');
    expect(panel.top).toBe(tone('#808080', FURNITURE_LIGHT.panelTop));
    expect(panel.bottom).toBe(tone('#808080', FURNITURE_LIGHT.panelBottom));
    expect(face.top).toBe(tone('#808080', FURNITURE_LIGHT.faceTop));
    expect(face.bottom).toBe(tone('#808080', FURNITURE_LIGHT.faceBottom));
    expect(panel.edge).toBe(face.edge);
    // Lit is lighter than shaded, and a face is darker than a panel.
    expect(parseInt(panel.top.slice(1, 3), 16)).toBeGreaterThan(parseInt(face.top.slice(1, 3), 16));
  });

  it('writes one gradient per material, not one per part', () => {
    const parts = [
      ellipse('shadow', 0, 0, 1, 1),
      rect('panel', 0, 0, 1, 1, 0),
      rect('panel', 0, 0, 1, 1, 0),
      rect('panel', 0, 0, 1, 1, 0, '#b98352'),
      rect('face', 0, 0, 1, 1, 0, '#b98352'),
      path('rail', 'M0 0'),
    ];
    const keys = shadeKeys(parts, '#6a87ad');
    expect([...keys.keys()]).toEqual(['panel|#6a87ad', 'panel|#b98352', 'face|#b98352']);
    expect([...keys.values()].map((k) => k.index)).toEqual([0, 1, 2]);
  });

  it('lights a big drawing within a CPU budget', () => {
    const parts = Array.from({ length: 2000 }, (_, i) =>
      rect('panel', i, 0, 1, 1, 0, `#${(i % 16).toString(16).repeat(6)}`),
    );
    expect(cpuMsOf(() => shadeKeys(parts, '#000000'))).toBeLessThan(20);
  });
});
