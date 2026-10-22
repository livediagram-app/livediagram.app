// @vitest-environment jsdom
import { render, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DRAWING_ANIMATIONS, type PathElement, type TableElement } from '@livediagram/document';
import { AnimationLayer } from './AnimationLayer';
import { useDrawingAnimation } from './drawing-animation';
import { InlineTextLine } from './InlineTextLine';
import { useTableAnimation } from './useTableAnimation';

const path = (animation?: string) =>
  ({
    id: 'p',
    type: 'path',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    closed: false,
    nodes: [
      { nx: 0, ny: 1, mode: 'corner' },
      { nx: 1, ny: 0, mode: 'corner' },
    ],
    ...(animation ? { animation } : {}),
  }) as unknown as PathElement;

describe('AnimationLayer', () => {
  it('is a plain layer for the ring, halo and band, and a measured outline for Trace', () => {
    expect(
      renderToStaticMarkup(<AnimationLayer animation="pulse" width={80} height={40} radius={6} />),
    ).toBe('<span class="lvd-anim-layer" aria-hidden="true"></span>');
    const trace = renderToStaticMarkup(
      <AnimationLayer animation="trace" width={80} height={40} radius={100} />,
    );
    expect(trace).toContain('lvd-svg-trace-tail');
    expect(trace).toContain('lvd-svg-trace-head');
    // The corner never exceeds half the box.
    expect(trace).toContain('rx="20"');
  });
});

describe('useDrawingAnimation', () => {
  it('gives every Drawing value its class, and nothing to a still drawing', () => {
    const still = renderHook(() => useDrawingAnimation(path(), 'M0 50 L100 0', 3, '#000')).result
      .current;
    expect(still.mainProps).toEqual({});
    for (const v of DRAWING_ANIMATIONS) {
      const parts = renderHook(() => useDrawingAnimation(path(v), 'M0 50 L100 0', 3, '#000')).result
        .current;
      expect(String(parts.mainProps.className)).toContain(`lvd-draw-${v}`);
    }
  });

  it('masks Draw, filters Boil and overlays Trace, all over a region the drawing’s size', () => {
    const draw = renderHook(() => useDrawingAnimation(path('draw'), 'M0 50 L100 0', 3, '#000'))
      .result.current;
    expect(draw.mainProps.mask).toMatch(/^url\(#/);
    const { container } = render(<svg>{draw.defs}</svg>);
    const mask = container.querySelector('mask')!;
    expect(Number(mask.getAttribute('width'))).toBeLessThan(1000);
    const boil = renderHook(() => useDrawingAnimation(path('boil'), 'M0 50 L100 0', 3, '#000'))
      .result.current;
    expect(render(<svg>{boil.defs}</svg>).container.querySelectorAll('filter')).toHaveLength(3);
    const trace = renderHook(() => useDrawingAnimation(path('trace'), 'M0 50 L100 0', 3, '#000'))
      .result.current;
    expect(renderToStaticMarkup(<>{trace.overlay}</>)).toContain('lvd-draw-head');
  });
});

describe('InlineTextLine with a Text animation', () => {
  it('draws the animated copy over the line, which stays for editing', () => {
    const { container } = render(
      <InlineTextLine
        value="Plan"
        placeholder="Title"
        editable
        onCommit={() => {}}
        zoom={1}
        maxLength={80}
        ariaLabel="Page title"
        animated={{
          node: <span className="lvd-tx-unit">Plan</span>,
          className: 'lvd-tx',
          style: {},
        }}
      />,
    );
    expect(container.querySelector('.lvd-tx .lvd-tx-unit')).not.toBeNull();
    expect(container.querySelector('[role="textbox"]')!.className).toContain('opacity-0');
  });
});

describe('useTableAnimation', () => {
  it('starts each cell’s units where the cell before it ended', () => {
    const table = {
      id: 't',
      type: 'table',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      cells: [
        ['ab', 'cde'],
        ['f', ''],
      ],
      textAnimation: 'typewriter',
      animation: 'rows',
    } as unknown as TableElement;
    const r = renderHook(() => useTableAnimation(table, '#000', false)).result.current;
    expect(r.textStarts).toEqual([
      [0, 2],
      [5, 6],
    ]);
    expect(r.gridClass).toBe('lvd-tbl-rows');
    expect(r.gridStyle).toMatchObject({ '--lvd-rows': 2, '--lvd-cols': 2 });
  });

  it('stands still while a cell is being edited', () => {
    const table = {
      id: 't',
      type: 'table',
      cells: [['a']],
      textAnimation: 'wave',
    } as unknown as TableElement;
    expect(
      renderHook(() => useTableAnimation(table, '#000', true)).result.current.textAnim,
    ).toBeUndefined();
  });
});
