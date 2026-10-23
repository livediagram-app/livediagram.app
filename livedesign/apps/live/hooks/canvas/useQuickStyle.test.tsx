// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAppearanceForTests, setAppearance } from '@livedesign/ui';
import {
  createFreehand,
  createShape,
  defaultScheme,
  PEN_INK,
  type Element,
  type Tab,
} from '@livedesign/design';
import { DEFAULT_WHITEBOARD_PREFS, type WhiteboardPen } from '@/lib/whiteboard-prefs';
import type { PendingDraw } from '@/lib/draw-mode';
import { useQuickStyle } from './useQuickStyle';

// docs/specs/023-draw-mode/drawing-tools.md "The quick style panel": the marker rows style the
// selected strokes as one commit, or the marker in hand when nothing is selected.
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
  memory = {
    recordEdit: vi.fn(),
    forget: vi.fn(),
    styleNewElement: <T,>(el: T) => el,
  },
  initial: Element[] = [stroke],
) {
  let elements: Element[] = initial;
  const tab = { id: 't', name: 'Board', elements } as unknown as Tab;
  const commit = vi.fn((map: (els: Element[]) => Element[]) => {
    elements = map(elements);
  });
  const update = vi.fn();
  const { result } = renderHook(() =>
    useQuickStyle({
      activeTab: tab,
      theme: defaultScheme('light'),
      selectionIds: new Set(selection),
      editsBlocked: false,
      liveElements: () => elements,
      commit,
      memory,
      swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() },
      pen: { held, update },
      toolIntent,
    }),
  );
  return { result, commit, update, memory, elements: () => elements };
}

afterEach(() => resetAppearanceForTests());

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

  it('restyles with stock and custom colours', () => {
    // A custom colour comes from More colours, the colour picker.
    const { result, elements } = setup(['s1']);
    act(() => result.current.setPenColour('teal'));
    expect(elements()[0]).toMatchObject({ penColour: 'teal' });
    act(() => result.current.setPenColour('#ff6b00'));
    expect(elements()[0]).toMatchObject({ strokeColor: '#ff6b00' });
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

// docs/specs/008-canvas/quick-style-panel.md "Multi-selection": marker strokes beside other kinds.
describe('useQuickStyle on a mixed selection', () => {
  const square = { ...createShape('square', 0, 0), id: 'q1', penColour: 'blue' } as Element;
  const sticky = { id: 'n1', type: 'sticky', x: 0, y: 0, width: 9, height: 9 } as Element;
  const memory = {
    recordEdit: vi.fn(),
    forget: vi.fn(),
    styleNewElement: <T,>(el: T) => el,
  };

  it('shows the marker rows and the shape rows, captioned by the styled count', () => {
    const { result } = setup(['s1', 'q1', 'n1'], null, null, memory, [stroke, square, sticky]);
    const view = result.current.view!;
    expect(view.pen?.subject).toMatchObject({ kind: 'strokes', ids: ['s1'] });
    expect(view.sections.stroke).toBeTruthy();
    expect(view.caption).toBe('2 elements');
  });

  // docs/specs/004-interface-design/colour-picker.md "Skins": a row's More colours.
  it('sets any colour from More colours: a stock name on a line or text, a hex on a fill', () => {
    const { result, elements } = setup(['q1'], null, null, memory, [square]);
    act(() => result.current.setColour('stroke', 'grey'));
    expect(elements()[0]).toMatchObject({ penColour: 'grey', strokeColor: undefined });
    act(() => result.current.setColour('text', '#123456'));
    expect(elements()[0]).toMatchObject({ textColor: '#123456', penTextColour: undefined });
    act(() => result.current.setColour('fill', '#abcdef'));
    expect(elements()[0]).toMatchObject({ fillColor: '#abcdef' });
  });

  it('gives the selection priority over the marker in hand', () => {
    const { result } = setup(['s1']);
    expect(result.current.view?.caption).toBe('Marker stroke');
  });
});

// docs/specs/008-canvas/canvas-and-palette.md: the Ink swatch shows its version for the canvas
// the tab paints, which on a dark theme is the dark one in any appearance.
describe('useQuickStyle swatches on a themed canvas', () => {
  it('shows the dark canvas Ink on a dark theme', () => {
    // A dark viewer sees Midnight as written (docs/specs/011-theme/light-and-dark.md).
    setAppearance('dark');
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
        theme: defaultScheme('light'),
        selectionIds: new Set(['q1']),
        editsBlocked: false,
        liveElements: () => tab.elements,
        commit: vi.fn(),
        memory: {
          recordEdit: vi.fn(),
          forget: vi.fn(),
          styleNewElement: <T,>(el: T) => el,
        },
        swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() },
        pen: { held: DEFAULT_WHITEBOARD_PREFS.pens[1]!, update: vi.fn() },
        toolIntent: null,
      }),
    );
    expect(result.current.view!.sections.stroke!.ink).toBe(PEN_INK.dark);
  });
});

// docs/specs/008-canvas/highlighter.md "Settings": the Highlighter rows, on a diagram tab.
describe('useQuickStyle Highlighter rows', () => {
  const highlight = {
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 40, y: 10 },
      ],
      false,
    ),
    id: 'h1',
    pen: 'highlighter',
    strokeColor: '#fde047',
  } as Element;
  const box = { ...createShape('square', 100, 0), id: 'b1' } as Element;

  function diagram(selection: string[], toolIntent: PendingDraw | null = null) {
    let elements: Element[] = [highlight, box];
    const tab = { id: 't', name: 'Tab', elements } as unknown as Tab;
    const commit = vi.fn((map: (els: Element[]) => Element[]) => {
      elements = map(elements);
    });
    const highlighter = { colour: '#fde047', width: 14, setColour: vi.fn(), setWidth: vi.fn() };
    const { result } = renderHook(() =>
      useQuickStyle({
        activeTab: tab,
        theme: defaultScheme('light'),
        selectionIds: new Set(selection),
        editsBlocked: false,
        liveElements: () => elements,
        commit,
        memory: {
          recordEdit: vi.fn(),
          forget: vi.fn(),
          styleNewElement: <T,>(el: T) => el,
        },
        swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() },
        highlighter,
        toolIntent,
      }),
    );
    return { result, commit, highlighter, elements: () => elements };
  }

  it('shows the armed tile’s next stroke, and sets it without touching the board', () => {
    const { result, commit, highlighter } = diagram([], {
      type: 'freehand',
      variant: 'highlighter',
    });
    expect(result.current.view?.highlighter?.subject).toEqual({
      kind: 'tool',
      name: 'Highlighter',
    });
    act(() => result.current.setHighlighterColour('#86efac'));
    act(() => result.current.setHighlighterWidth('thin'));
    expect(highlighter.setColour).toHaveBeenCalledWith('#86efac');
    expect(highlighter.setWidth).toHaveBeenCalledWith(8);
    expect(commit).not.toHaveBeenCalled();
  });

  it('shows no Highlighter rows with nothing selected and nothing armed', () => {
    expect(diagram([]).result.current.view).toBeNull();
  });

  it('restyles the selected highlights in one commit, and counts a mixed selection', () => {
    const { result, commit, elements } = diagram(['h1', 'b1']);
    expect(result.current.view?.caption).toBe('2 elements');
    act(() => result.current.setHighlighterWidth('bold'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(elements()[0]).toMatchObject({ penWidth: 22 });
    expect(elements()[1]).toBe(box);
  });
});
