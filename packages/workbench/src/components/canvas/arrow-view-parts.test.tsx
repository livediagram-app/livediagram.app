// @vitest-environment jsdom
import type { PointerEvent as ReactPointerEvent } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARROW_MASK_SPAN,
  arrowBehindMask,
  arrowEndMarkers,
  arrowFlowStyle,
  arrowPressGuards,
} from './arrow-view-parts';

// The parts every product's ArrowView draws alike (each editor's docs/specs/008-canvas/arrow-route-behind.md,
// arrow-bending.md and canvas-and-palette.md).
afterEach(cleanup);

const press = (t: number, x = 10, y = 10) =>
  ({ timeStamp: t, clientX: x, clientY: y }) as unknown as ReactPointerEvent;

describe('arrowBehindMask', () => {
  it('paints the vast backdrop white and cuts each hole black', () => {
    const { container } = render(
      <svg>
        {arrowBehindMask('m1', [
          { x: 1, y: 2, width: 3, height: 4, rx: 5 },
          { x: 6, y: 7, width: 8, height: 9, rx: 0 },
        ])}
      </svg>,
    );
    const mask = container.querySelector('mask')!;
    expect(mask.id).toBe('m1');
    expect(mask.getAttribute('maskUnits')).toBe('userSpaceOnUse');
    expect(mask.getAttribute('width')).toBe(String(ARROW_MASK_SPAN.size));
    const rects = [...mask.querySelectorAll('rect')];
    expect(rects.map((r) => r.getAttribute('fill'))).toEqual(['white', 'black', 'black']);
    expect(rects[1]!.getAttribute('rx')).toBe('5');
    expect(rects[2]!.getAttribute('x')).toBe('6');
  });
});

describe('arrowPressGuards', () => {
  it('opens the editor on the release of a paired press, and not on a cancelled one', () => {
    const onBeginEdit = vi.fn();
    const g = arrowPressGuards({ id: 'a1', isSelected: true, blocked: false, onBeginEdit });
    expect(g.guardPress(press(1000))).toBe(false);
    expect(g.guardPress(press(1100))).toBe(true);
    window.dispatchEvent(new Event('pointerup'));
    expect(onBeginEdit).toHaveBeenCalledWith('a1');
    window.dispatchEvent(new Event('pointerup'));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);

    g.openEditor();
    window.dispatchEvent(new Event('pointercancel'));
    window.dispatchEvent(new Event('pointerup'));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });

  it('opens nothing on a locked arrow', () => {
    const onBeginEdit = vi.fn();
    const g = arrowPressGuards({ id: 'a2', isSelected: false, blocked: true, onBeginEdit });
    expect(g.pairsWithLast(press(5000))).toBe(false);
    expect(g.guardPress(press(5100))).toBe(true);
    window.dispatchEvent(new Event('pointerup'));
    expect(onBeginEdit).not.toHaveBeenCalled();
  });
});

describe('arrowFlowStyle', () => {
  const base = { flowFactor: 2, strokeWidth: 3, baseStroke: '#123456' };

  it('is just no hit-testing for a still line', () => {
    expect(
      arrowFlowStyle({ ...base, flow: undefined, flowRepeat: undefined, flowPathClass: undefined }),
    ).toEqual({ pointerEvents: 'none' });
  });

  it('carries the speed, the width the breathing flows swell from and the play-once hold', () => {
    expect(
      arrowFlowStyle({ ...base, flow: 'grow', flowRepeat: false, flowPathClass: 'lvd-grow' }),
    ).toEqual({
      pointerEvents: 'none',
      '--lvd-flow-speed': 2,
      '--lvd-flow-w': '3px',
      '--lvd-flow-iter': 1,
    });
  });

  it('tints the halo flows with the line colour', () => {
    expect(
      arrowFlowStyle({ ...base, flow: 'glow', flowRepeat: true, flowPathClass: 'lvd-glow' }),
    ).toEqual({ pointerEvents: 'none', '--lvd-flow-speed': 2, '--lvd-flow-color': '#123456' });
  });
});

describe('arrowEndMarkers', () => {
  it('puts the heads on the ends the arrow names', () => {
    expect(arrowEndMarkers(undefined, 's', 'h')).toEqual({
      markerStart: undefined,
      markerEnd: 'h',
    });
    expect(arrowEndMarkers('to', 's', 'h')).toEqual({ markerStart: undefined, markerEnd: 'h' });
    expect(arrowEndMarkers('from', 's', 'h')).toEqual({ markerStart: 's', markerEnd: undefined });
    expect(arrowEndMarkers('both', 's', 'h')).toEqual({ markerStart: 's', markerEnd: 'h' });
    expect(arrowEndMarkers('none', 's', 'h')).toEqual({
      markerStart: undefined,
      markerEnd: undefined,
    });
  });
});
