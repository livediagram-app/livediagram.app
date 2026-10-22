// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livedesign/document';
import { useNudgeSelection } from './useNudgeSelection';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Arrow-key nudge (docs/specs/008-canvas/canvas-and-palette.md Move).

function shape(id: string, x: number, y: number): Element {
  return { id, type: 'shape', shape: 'square', x, y, width: 100, height: 100 };
}

function harness(opts: {
  elements: Element[];
  selected?: string;
  multi?: string[];
}) {
  let elements = opts.elements;
  const nudge = renderHook(() =>
    useNudgeSelection({
      isReadOnly: false,
      readSelection: () => ({
        selectedId: opts.selected ?? null,
        multiSelectedIds: new Set(opts.multi ?? []),
      }),
      get activeTab() {
        return { id: 't', name: 'T', elements } as Tab;
      },
      markCheckpoint: () => 1,
      tick: (m) => {
        elements = m(elements);
      },
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
  it('nudges by pixels, up / down and left / right alike', () => {
    const h = harness({ elements: [shape('s', 0, 57)], selected: 's' });
    h.press(0, 10);
    expect(h.at('s').y).toBe(67);
    h.press(10, 0);
    expect(h.at('s').x).toBe(10);
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Locking": a locked element is never nudged, alone or in a selection.
describe('nudging a locked element', () => {
  it('moves the rest of the selection and leaves the locked one where it is', () => {
    const locked = { ...shape('l', 0, 0), locked: true } as Element;
    const h = harness({
      elements: [locked, shape('s', 200, 0)],
      multi: ['l', 's']
    });
    h.press(10, 0);
    expect(h.at('l').x).toBe(0);
    expect(h.at('s').x).toBe(210);
    const alone = harness({ elements: [locked], selected: 'l' });
    alone.press(10, 0);
    expect(alone.at('l').x).toBe(0);
  });
});
