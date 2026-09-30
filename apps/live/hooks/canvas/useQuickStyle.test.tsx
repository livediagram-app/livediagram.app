// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFreehand, defaultScheme, type Element, type Tab } from '@livediagram/document';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
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

function setup(selection: string[], held = DEFAULT_WHITEBOARD_PREFS.pens[1]!) {
  let elements: Element[] = [stroke];
  const tab = { id: 't', name: 'Board', kind: 'whiteboard', elements } as unknown as Tab;
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
      memory: { recordEdit: vi.fn(), forget: vi.fn() } as never,
      swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() } as never,
      pen: { held, update },
    }),
  );
  return { result, commit, update, elements: () => elements };
}

describe('useQuickStyle pen rows', () => {
  it('restyles the selected strokes in one commit', () => {
    const { result, commit, elements } = setup(['s1']);
    expect(result.current.view?.pen?.subject).toEqual({ kind: 'strokes', ids: ['s1'] });
    act(() => result.current.setPenWidth('bold'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(elements()[0]).toMatchObject({ penWidth: 2.5 });
  });

  it('sets the pen in hand when nothing is selected, in px and with ink as null', () => {
    const { result, commit, update } = setup([]);
    expect(result.current.view?.pen?.subject).toMatchObject({ kind: 'pen', id: 'second' });
    act(() => result.current.setPenWidth('fine'));
    expect(update).toHaveBeenCalledWith('second', { width: 1 });
    act(() => result.current.setPenColour('#2f9e44'));
    expect(update).toHaveBeenCalledWith('second', { colour: '#2f9e44' });
    expect(commit).not.toHaveBeenCalled();
  });
});
