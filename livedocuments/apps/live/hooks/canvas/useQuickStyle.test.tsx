// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAppearanceForTests, setAppearance } from '@livedocuments/ui';
import { createShape, defaultScheme, PEN_INK, type Element, type Tab } from '@livedocuments/document';
import { useQuickStyle } from './useQuickStyle';

function setup(tab: Tab, selection: string[]) {
  let elements: Element[] = tab.elements;
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
      memory,
      swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() },
    }),
  );
  return { result, commit, memory, elements: () => elements };
}

afterEach(() => resetAppearanceForTests());

// docs/specs/008-canvas/quick-style-panel.md: each choice is one commit over the selection, recorded
// into style memory.
describe('useQuickStyle', () => {
  it('restyles the selection in one commit and remembers it', () => {
    const square = { ...createShape('square', 0, 0), id: 'q1' } as Element;
    const tab = { id: 't', name: 'Board', elements: [square] } as unknown as Tab;
    const { result, commit, memory, elements } = setup(tab, ['q1']);
    act(() => result.current.setWidth('thick'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(memory.recordEdit).toHaveBeenCalledTimes(1);
    expect((elements()[0] as { strokeWidth?: string }).strokeWidth).toBe('thick');
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
    const { result } = setup(tab, ['q1']);
    expect(result.current.view!.sections.stroke!.ink).toBe(PEN_INK.dark);
  });
});
