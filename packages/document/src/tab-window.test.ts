import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isValidElement, type ShapeElement } from './index';
import { svgBoxed } from './svg-render';
import {
  prefixSvgIds,
  svgTabWindow,
  TAB_WINDOW_SIZE,
  tabWindowMayShow,
  tabWindowNames,
  tabWindowOffers,
} from './tab-window';

// docs/specs/009-elements/tab-window.md

const windowOn = (extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape('tab-window', 100, 50), id: 'w1', ...extra }) as ShapeElement;

describe('which tabs a window may show', () => {
  const tabs = [
    { id: 'slides', opensIn: 'illustrate' },
    { id: 'diagram' },
    { id: 'es', kind: 'event-storming' },
    { id: 'board', kind: 'board' },
    { id: 'sheet', kind: 'sheet' },
    { id: 'dash', kind: 'dashboard' },
    { id: 'planned', opensIn: 'plan' },
    { id: 'drawing', opensIn: 'draw' },
  ];

  it('offers every tab but its own and a Plan tab, in tab-bar order', () => {
    expect(tabWindowOffers(tabs, 'slides').map((t) => t.id)).toEqual(['diagram', 'es', 'drawing']);
  });

  it('never shows its own tab', () => {
    expect(tabWindowMayShow({ id: 'diagram' }, 'diagram')).toBe(false);
    expect(tabWindowMayShow({ id: 'diagram' }, undefined)).toBe(true);
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

describe('prefixSvgIds', () => {
  it('prefixes every id and the references to it, and nothing else', () => {
    const svg =
      '<svg><defs><linearGradient id="g1"/><marker id="m"/></defs>' +
      '<rect fill="url(#g1)"/><path marker-end="url(#m)"/><use href="#m"/><rect fill="url(#other)"/></svg>';
    expect(prefixSvgIds(svg, 'tw-')).toBe(
      '<svg><defs><linearGradient id="tw-g1"/><marker id="tw-m"/></defs>' +
        '<rect fill="url(#tw-g1)"/><path marker-end="url(#tw-m)"/><use href="#tw-m"/><rect fill="url(#other)"/></svg>',
    );
  });

  it('leaves markup without ids as it is', () => {
    expect(prefixSvgIds('<svg><rect/></svg>', 'x-')).toBe('<svg><rect/></svg>');
  });
});

describe('svgTabWindow', () => {
  const drawing = {
    markup:
      '<svg width="400" height="200" viewBox="0 0 400 200"><rect id="r" width="10" height="10"/></svg>',
    width: 400,
    height: 200,
    background: '#fafaf9',
  };

  it('fits the tab inside its rounded frame, on the tab paper, ids its own', () => {
    const svg = svgTabWindow(windowOn(), { name: 'Architecture', drawing }, undefined);
    expect(svg).toContain('viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('fill="#fafaf9"');
    expect(svg).toContain('id="tw-w1-r"');
    expect(svg).toContain('clip-path="url(#tw-w1-clip)"');
    expect(svg).toContain('rx="12"');
  });

  it('draws its frame named for its tab without a drawing, else "Tab Window"', () => {
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
  it('lands 16:9 and validates with its tab', () => {
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
