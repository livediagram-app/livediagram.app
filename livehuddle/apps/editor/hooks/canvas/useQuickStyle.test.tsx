// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createFreehand,
  createShape,
  defaultScheme,
  type Element,
  type Tab,
} from '@livehuddle/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { useQuickStyle } from './useQuickStyle';

// docs/specs/008-canvas/quick-style-panel.md: each choice is one commit over the selection, remembered.
describe('useQuickStyle on a selection', () => {
  const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;
  const sticky = { id: 'n1', type: 'sticky', x: 0, y: 0, width: 9, height: 9 } as Element;

  function setup(selection: string[]) {
    let elements: Element[] = [square, sticky];
    const tab = { id: 't', name: 'Tab', elements } as unknown as Tab;
    const commit = vi.fn((map: (els: Element[]) => Element[]) => {
      elements = map(elements);
    });
    const memory = { recordEdit: vi.fn(), forget: vi.fn(), styleNewElement: <T,>(el: T) => el };
    const { result } = renderHook(() =>
      useQuickStyle({
        activeTab: tab,
        theme: defaultScheme('light'),
        selectionIds: new Set(selection),
        editsBlocked: false,
        liveElements: () => elements,
        commit,
        memory: memory as never,
        swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() },
      }),
    );
    return { result, commit, memory, elements: () => elements };
  }

  // docs/specs/004-interface-design/colour-picker.md "Skins": a row's More colours.
  it('sets any colour from More colours, restyling only what the rows fit', () => {
    const { result, commit, memory, elements } = setup(['q1', 'n1']);
    expect(result.current.view?.targetIds).toEqual(['q1']);
    act(() => result.current.setColour('fill', '#abcdef'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(memory.recordEdit).toHaveBeenCalledTimes(1);
    expect(elements()[0]).toMatchObject({ fillColor: '#abcdef' });
    expect(elements()[1]).toBe(sticky);
  });

  it('clears the styles and forgets the kinds the selection styles', () => {
    const { result, memory, elements } = setup(['q1']);
    act(() => result.current.setColour('fill', '#abcdef'));
    act(() => result.current.clearStyles());
    expect(elements()[0]).not.toMatchObject({ fillColor: '#abcdef' });
    expect(memory.forget).toHaveBeenCalledWith(['shape:square']);
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
        } as never,
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
