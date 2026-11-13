import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { coerceShapeKind, isValidElement, SHAPE_KINDS, type ShapeElement } from './index';
import { svgBoxed } from './svg-render';
import { RETIRED_SHAPE_KINDS, TAB_WINDOW_SIZE } from './tab-window';

// docs/specs/009-elements/tab-window.md (retired): a stored window still loads, and draws as a frame named for its tab.

const windowOn = (extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape('tab-window', 100, 50), id: 'w1', ...extra }) as ShapeElement;

describe('the retired kinds', () => {
  it('names the tab window, still a kind a stored element may be', () => {
    expect([...RETIRED_SHAPE_KINDS]).toEqual(['tab-window']);
    expect(SHAPE_KINDS.has('tab-window')).toBe(true);
    expect(coerceShapeKind('tab-window')).toBe('tab-window');
  });
});

describe('a stored tab window', () => {
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
