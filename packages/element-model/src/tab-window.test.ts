import { describe, expect, it } from 'vitest';
import { RETIRED_SHAPE_KINDS, svgTabWindow, tabWindowNames, type TabWindowElement } from './tab-window';

// Each product's tab-window spec (retired): a stored window draws as a frame named for its tab.
const windowOn = (): TabWindowElement => ({ type: 'shape', x: 0, y: 0, width: 640, height: 360 });

describe('the retired kinds', () => {
  it('names the tab window', () => {
    expect([...RETIRED_SHAPE_KINDS]).toEqual(['tab-window']);
  });
});

describe('tabWindowNames', () => {
  it('names a window for the tab it shows, Untitled for a blank name, nothing for no tab', () => {
    const names = tabWindowNames([
      { id: 'a', name: 'Flow' },
      { id: 'b', name: '' },
    ]);
    const w = (windowTabId?: string) =>
      ({
        id: 'w',
        type: 'shape',
        shape: 'tab-window',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        windowTabId,
      }) as never;
    expect(names(w('a'))).toEqual({ name: 'Flow' });
    expect(names(w('b'))).toEqual({ name: 'Untitled tab' });
    expect(names(w('gone'))).toBeUndefined();
    expect(names(w())).toBeUndefined();
  });
});

describe('svgTabWindow', () => {
  it('draws its rounded frame named for its tab, else "Tab Window"', () => {
    const svg = svgTabWindow(windowOn(), { name: 'Architecture' }, undefined);
    expect(svg).toContain('>Architecture<');
    expect(svg).toContain('rx="12"');
    expect(svgTabWindow(windowOn(), undefined, undefined)).toContain('>Tab Window<');
  });

  it('escapes a tab name', () => {
    expect(svgTabWindow(windowOn(), { name: '<b>&' }, undefined)).toContain('&lt;b&gt;&amp;');
  });

  it('strokes its edge in its own colour, else the hairline', () => {
    expect(svgTabWindow(windowOn(), undefined, '#ff0000')).toContain('stroke="#ff0000"');
    expect(svgTabWindow(windowOn(), undefined, undefined)).toContain('stroke="#cbd5e1"');
  });

  it('takes the dark paper ground on a dark surface, and a hand-drawn edge under Sketch', () => {
    expect(svgTabWindow(windowOn(), undefined, undefined, 'dark')).toContain('fill="#1e293b"');
    expect(svgTabWindow(windowOn(), undefined, undefined, 'light', true)).toContain(
      '<g filter="url(#',
    );
  });
});
