import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isValidElement, type ShapeElement } from './index';
import { svgBoxed } from './svg-render';
import { RETIRED_SHAPE_KINDS, svgTabWindow, TAB_WINDOW_SIZE, tabWindowNames } from './tab-window';

// docs/specs/009-elements/tab-window.md (retired): a stored window loads and draws as its named frame.

const windowOn = (extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape('tab-window', 100, 50), id: 'w1', ...extra }) as ShapeElement;

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
  it('draws its frame named for its tab, else "Tab Window"', () => {
    expect(svgTabWindow(windowOn(), { name: 'Architecture' }, undefined)).toContain(
      '>Architecture<',
    );
    expect(svgTabWindow(windowOn(), undefined, undefined)).toContain('>Tab Window<');
  });

  it('escapes a tab name', () => {
    expect(svgTabWindow(windowOn(), { name: '<b>&' }, undefined)).toContain('&lt;b&gt;&amp;');
  });

  it('strokes its edge in its own colour, else the hairline', () => {
    expect(svgTabWindow(windowOn(), undefined, '#ff0000')).toContain('stroke="#ff0000"');
    expect(svgTabWindow(windowOn(), undefined, undefined)).toContain('stroke="#cbd5e1"');
  });
});

describe('the tab-window kind', () => {
  it('is retired: kept so stored ones load, offered by nothing', () => {
    expect(RETIRED_SHAPE_KINDS.has('tab-window')).toBe(true);
  });

  it('keeps its 16:9 size and validates with its tab', () => {
    const el = windowOn({ windowTabId: 'tab-1' });
    expect({ width: el.width, height: el.height }).toEqual(TAB_WINDOW_SIZE);
    expect(isValidElement(el)).toBe(true);
    expect(isValidElement({ ...el, windowTabId: '' })).toBe(false);
  });

  it('exports through the resolver, or its frame without one', () => {
    const el = windowOn({ windowTabId: 'tab-1' });
    expect(svgBoxed(el)).toContain('>Tab Window<');
    const resolved = svgBoxed(el, {
      resolveTabWindow: (w) => (w.windowTabId === 'tab-1' ? { name: 'Flow' } : undefined),
    });
    expect(resolved).toContain('>Flow<');
    // No standard label under or over it.
    expect(resolved.match(/<text/g)).toHaveLength(1);
  });
});
