// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createFreehand,
  createShape,
  defaultScheme,
  PEN_INK,
  penColourHex,
  type Element,
  type Tab,
} from '@livediagram/document';
import { DEFAULT_WHITEBOARD_PREFS, type WhiteboardPen } from '@/lib/whiteboard-prefs';
import type { PendingDraw } from '@/lib/draw-mode';
import { whiteboardShapeIntent } from '@/lib/whiteboard-tool';
import { useQuickStyle } from './useQuickStyle';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": the pen rows style the
// selected strokes as one commit, or the pen in hand when nothing is selected.
const stroke = {
  ...createFreehand(
    [
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ],
    false,
  ),
  id: 's1',
  penWidth: 1.5,
} as Element;

function setup(
  selection: string[],
  held: WhiteboardPen | null = DEFAULT_WHITEBOARD_PREFS.pens[1]!,
  toolIntent: PendingDraw | null = null,
  memory = { recordEdit: vi.fn(), forget: vi.fn(), styleNewElement: <T,>(el: T) => el },
  initial: Element[] = [stroke],
) {
  let elements: Element[] = initial;
  const tab = { id: 't', name: 'Board', opensIn: 'draw', elements } as unknown as Tab;
  const commit = vi.fn((map: (els: Element[]) => Element[]) => {
    elements = map(elements);
  });
  const update = vi.fn();
  const colours = { remember: vi.fn() };
  const { result } = renderHook(() =>
    useQuickStyle({
      activeTab: tab,
      drawMode: true,
      theme: defaultScheme('light'),
      selectionIds: new Set(selection),
      editsBlocked: false,
      liveElements: () => elements,
      commit,
      memory: memory as never,
      swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() } as never,
      pen: { held, update, colours },
      toolIntent,
    }),
  );
  return { result, commit, update, memory, colours, elements: () => elements };
}

describe('useQuickStyle pen rows', () => {
  it('restyles the selected strokes in one commit', () => {
    const { result, commit, elements } = setup(['s1']);
    expect(result.current.view?.pen?.subject).toEqual({
      kind: 'strokes',
      ids: ['s1'],
      name: 'Marker stroke',
    });
    act(() => result.current.setPenWidth('bold'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(elements()[0]).toMatchObject({ penWidth: 2.5 });
  });

  it('offers the tab\u2019s custom colours, and remembers a custom restyle in Your colours', () => {
    // docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": the second section.
    const { result, elements, colours } = setup(['s1']);
    expect(result.current.view?.pen?.colour.custom).toEqual([]);
    act(() => result.current.setPenColour('teal'));
    expect(elements()[0]).toMatchObject({ penColour: 'teal' });
    expect(colours.remember).toHaveBeenCalledWith('teal');
    act(() => result.current.setPenColour('#ff6b00'));
    expect(elements()[0]).toMatchObject({ strokeColor: '#ff6b00' });
    expect(colours.remember).toHaveBeenLastCalledWith('#ff6b00');
    act(() => result.current.setPenColour('ink'));
    expect(colours.remember).toHaveBeenLastCalledWith(null);
  });

  it('sets the pen in hand when nothing is selected, in px and with ink as null', () => {
    const { result, commit, update } = setup([]);
    expect(result.current.view?.pen?.subject).toMatchObject({ kind: 'pen', id: 'second' });
    act(() => result.current.setPenWidth('fine'));
    expect(update).toHaveBeenCalledWith('second', { width: 1 });
    act(() => result.current.setPenColour('green'));
    expect(update).toHaveBeenCalledWith('second', { colour: 'green' });
    act(() => result.current.setPenColour('ink'));
    expect(update).toHaveBeenCalledWith('second', { colour: null });
    expect(commit).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/quick-style-panel.md "Multi-selection": any mix of kinds on a whiteboard.
describe('useQuickStyle on a mixed whiteboard selection', () => {
  const square = { ...createShape('square', 0, 0), id: 'q1', penColour: 'blue' } as Element;
  const sticky = { id: 'n1', type: 'sticky', x: 0, y: 0, width: 9, height: 9 } as Element;
  const memory = { recordEdit: vi.fn(), forget: vi.fn(), styleNewElement: <T,>(el: T) => el };

  it('shows the marker rows and the shape rows, captioned by the styled count', () => {
    const { result } = setup(['s1', 'q1', 'n1'], null, null, memory, [stroke, square, sticky]);
    const view = result.current.view!;
    expect(view.pen?.subject).toMatchObject({ kind: 'strokes', ids: ['s1'] });
    // The Stroke row offers the whiteboard's colours, and marks the shape's named blue.
    expect(view.sections.stroke).toBeUndefined();
    expect(view.sections.boardStroke!.value).toBe('blue');
    expect(view.targetIds).toEqual(['q1']);
    expect(view.caption).toBe('2 elements');
  });

  it('restyles only what each row fits, leaving the sticky as it was', () => {
    const { result, commit, elements } = setup(['s1', 'q1', 'n1'], null, null, memory, [
      stroke,
      square,
      sticky,
    ]);
    act(() => result.current.setBoardStroke('ink'));
    expect(commit).toHaveBeenCalledTimes(1);
    const [s, q, n] = elements();
    expect(s).toBe(stroke);
    expect(n).toBe(sticky);
    expect((q as { penColour?: string }).penColour).toBe('ink');
  });

  it('stores a stock colour by name and moves a custom one to the front of Your colours', () => {
    const { result, elements, colours } = setup(['q1'], null, null, memory, [square]);
    act(() => result.current.setBoardStroke('teal'));
    expect(elements()[0]).toMatchObject({ penColour: 'teal' });
    expect(colours.remember).not.toHaveBeenCalled();
    act(() => result.current.setBoardStroke('#ff6b00'));
    expect(elements()[0]).toMatchObject({ strokeColor: '#ff6b00' });
    expect(colours.remember).toHaveBeenCalledWith('#ff6b00');
  });
});

// docs/specs/008-canvas/quick-style-panel.md "Corners": one commit, the rectangles only.
describe('useQuickStyle Corners', () => {
  it('rounds the selected rectangles in one commit, leaving the strokes', () => {
    const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;
    const memory = { recordEdit: vi.fn(), forget: vi.fn(), styleNewElement: <T,>(el: T) => el };
    const { result, commit, elements } = setup(['s1', 'q1'], null, null, memory, [stroke, square]);
    expect(result.current.view?.sections.corners).toEqual({ value: null });
    act(() => result.current.setCorners('sm'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(elements()[0]).toBe(stroke);
    expect(elements()[1]).toMatchObject({ borderRadius: 'sm' });
  });
});

describe('useQuickStyle for a tool in hand', () => {
  it('styles the next rectangle: remembered, nothing on the board changes', () => {
    const { result, commit, memory } = setup([], null, whiteboardShapeIntent('rectangle'));
    expect(result.current.view?.caption).toBe('Next rectangle');
    // A whiteboard's Stroke row is the whiteboard's colours.
    expect(result.current.view?.sections.boardStroke).toBeTruthy();
    act(() => result.current.setWidth('thick'));
    expect(commit).not.toHaveBeenCalled();
    const [before, after] = memory.recordEdit.mock.calls[0]!;
    expect(before[0]).toMatchObject({ type: 'shape', shape: 'square' });
    expect(after[0]).toMatchObject({ strokeWidth: 'thick' });
  });

  it('forgets the tool style on Clear styles', () => {
    const { result, memory } = setup([], null, whiteboardShapeIntent('arrow'));
    act(() => result.current.clearStyles());
    expect(memory.forget).toHaveBeenCalledWith(['board:arrow']);
  });

  it('gives the selection priority over the tool', () => {
    const { result } = setup(['s1'], null, whiteboardShapeIntent('rectangle'));
    // The selection's caption, never the tool's "Next rectangle".
    expect(result.current.view?.caption).toBe('Marker stroke');
  });
});

// docs/specs/007-editor/editor-modes.md "One look": the swatches show each stock colour in its
// version for the canvas the tab paints, which on a dark theme is the dark one in any appearance.
describe('useQuickStyle swatches on a themed canvas', () => {
  it('shows the dark canvas versions on a dark theme', () => {
    const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;
    const tab = {
      id: 't',
      name: 'Board',
      theme: 'midnight',
      backgroundColor: '#0f172a',
      elements: [square],
    } as unknown as Tab;
    const { result } = renderHook(() =>
      useQuickStyle({
        activeTab: tab,
        drawMode: true,
        theme: defaultScheme('light'),
        selectionIds: new Set(['q1']),
        editsBlocked: false,
        liveElements: () => tab.elements,
        commit: vi.fn(),
        memory: { recordEdit: vi.fn(), forget: vi.fn(), styleNewElement: <T,>(el: T) => el },
        swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() } as never,
        pen: { held: null, update: vi.fn(), colours: { remember: vi.fn() } },
        toolIntent: null,
      } as never),
    );
    const options = result.current.view!.sections.boardStroke!.options;
    expect(options[0]!.swatch).toBe(PEN_INK.dark);
    expect(options[1]!.swatch).toBe(penColourHex('blue', 'dark'));
  });
});
