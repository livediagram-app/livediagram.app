// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { useNudgeSelection } from './useNudgeSelection';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Arrow-key nudge (docs/specs/008-canvas/canvas-and-palette.md Move), and on an event-storming board the
// lane step (docs/specs/021-event-storming/event-storming.md "Always on a lane"): up / down move a workshop note a
// whole lane per press.

function workshop(id: string, x: number, y: number): StickyElement {
  return {
    id,
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    esKind: 'domain-event',
    fillColor: '#fdba74',
    fixedSize: true,
  } as StickyElement;
}

function shape(id: string, x: number, y: number): Element {
  return { id, type: 'shape', shape: 'square', x, y, width: 100, height: 100 } as Element;
}

function harness(opts: {
  elements: Element[];
  selected?: string;
  multi?: string[];
  laneBoard: boolean;
}) {
  let elements = opts.elements;
  const nudge = renderHook(() =>
    useNudgeSelection({
      isReadOnly: false,
      multiSelectedIds: new Set(opts.multi ?? []),
      selectedId: opts.selected ?? null,
      get activeTab() {
        return { id: 't', name: 'T', elements } as Tab;
      },
      laneBoard: opts.laneBoard,
      markCheckpoint: () => 1,
      tick: (m) => {
        elements = m(elements);
      },
      scheduleElementChangeLog: vi.fn(),
      autoRebindArrowsRef: { current: false },
    }),
  ).result;
  return {
    press: (dx: number, dy: number) => nudge.current(dx, dy),
    at: (id: string) => elements.find((e) => e.id === id) as Element & { x: number; y: number },
  };
}

afterEach(cleanup);

describe('useNudgeSelection', () => {
  it('moves a workshop note a whole lane per up / down press on an event-storming board', () => {
    const h = harness({ elements: [workshop('w', 10, 240)], selected: 'w', laneBoard: true });
    h.press(0, 1);
    expect(h.at('w')).toMatchObject({ x: 10, y: 480 });
    h.press(0, -10);
    h.press(0, -10);
    expect(h.at('w')).toMatchObject({ x: 10, y: 0 });
  });

  it('takes a note parked between lanes to the lane on the side it was pushed', () => {
    const h = harness({ elements: [workshop('w', 0, 130)], selected: 'w', laneBoard: true });
    h.press(0, -1);
    expect(h.at('w').y).toBe(0);
  });

  it('leaves left / right as the ordinary nudge', () => {
    const h = harness({ elements: [workshop('w', 10, 240)], selected: 'w', laneBoard: true });
    h.press(10, 0);
    expect(h.at('w')).toMatchObject({ x: 20, y: 240 });
  });

  it('moves a whole selection by its workshop note lane step', () => {
    const h = harness({
      elements: [shape('s', 0, 57), workshop('w', 300, 240)],
      multi: ['s', 'w'],
      laneBoard: true,
    });
    h.press(0, 1);
    expect(h.at('w').y).toBe(480);
    expect(h.at('s').y).toBe(57 + 240);
  });

  it('nudges by pixels on an ordinary board, and a selection with no workshop note', () => {
    const plain = harness({ elements: [workshop('w', 0, 240)], selected: 'w', laneBoard: false });
    plain.press(0, 1);
    expect(plain.at('w').y).toBe(241);
    const shapes = harness({ elements: [shape('s', 0, 57)], selected: 's', laneBoard: true });
    shapes.press(0, 10);
    expect(shapes.at('s').y).toBe(67);
  });
});
