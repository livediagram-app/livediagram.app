// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, defaultScheme, type Element, type Tab } from '@livehuddle/document';
import { storedFreehand } from '@/test/retired-elements';
import { useQuickStyle } from './useQuickStyle';

// docs/specs/008-canvas/quick-style-panel.md: each choice is one commit over the selection, remembered.
describe('useQuickStyle on a selection', () => {
  const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;
  const sticky = { id: 'n1', type: 'sticky', x: 0, y: 0, width: 9, height: 9 } as Element;
  // A stored highlighter stroke: retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
  // part 4), so the panel neither styles nor counts it.
  const highlight = storedFreehand(
    'h1',
    { x: 0, y: 0, width: 40, height: 10 },
    { pen: 'highlighter', strokeColor: '#fde047' },
  );

  function setup(selection: string[]) {
    let elements: Element[] = [square, sticky, highlight];
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

  it('leaves a stored highlighter stroke as it is, and shows nothing for it alone', () => {
    expect(setup(['h1']).result.current.view).toBeNull();
    const { result, elements } = setup(['q1', 'h1']);
    expect(result.current.view?.targetIds).toEqual(['q1']);
    act(() => result.current.setColour('stroke', '#abcdef'));
    act(() => result.current.clearStyles());
    expect(elements()[2]).toBe(highlight);
  });
});
