// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { packFreehandPoints, type Element, type Tab } from '@livediagram/document';
import { useTidyUpStrokes } from './useTidyUpStrokes';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/logo-pages.md "Tidy Up": one edit, in place, ids kept.
const line = (id: string, locked = false): Element =>
  ({
    id,
    type: 'freehand',
    closed: false,
    locked,
    ...packFreehandPoints(Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: Math.sin(i) }))),
  }) as Element;
const box = { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 5, height: 5 } as Element;

function setup(elements: Element[], ids: string[], readOnly = false) {
  let els = elements;
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const tab = { id: 't', elements } as unknown as Tab;
  const { result } = renderHook(() =>
    useTidyUpStrokes({
      activeTab: tab,
      currentSelectionIds: () => new Set(ids),
      commit,
      readOnly,
    }),
  );
  return { result, commit, now: () => els };
}

describe('useTidyUpStrokes', () => {
  it('cleans the selected unlocked lines in one commit, ids kept', () => {
    const s = setup([line('a'), line('l', true), box], ['a', 'l', 'b']);
    expect(s.result.current.canTidyUp()).toBe(true);
    act(() => s.result.current.tidyUpSelected());
    expect(s.commit).toHaveBeenCalledTimes(1);
    const [a, l, b] = s.now();
    expect(a).toMatchObject({ id: 'a', type: 'path' });
    expect(l!.type).toBe('freehand');
    expect(b).toBe(box);
  });

  it('tracks the tidy even when the commit runs its updater later', async () => {
    const { track } = await import('@/lib/telemetry');
    vi.mocked(track).mockClear();
    const commit = vi.fn();
    const tab = { id: 't', elements: [line('a')] } as unknown as Tab;
    const { result } = renderHook(() =>
      useTidyUpStrokes({
        activeTab: tab,
        currentSelectionIds: () => new Set(['a']),
        commit,
        readOnly: false,
      }),
    );
    act(() => result.current.tidyUpSelected());
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'StrokesTidiedUp');
    // The deferred updater still swaps the line for its tidied path.
    const [a] = (commit.mock.calls[0]![0] as (e: Element[]) => Element[])([line('a')]);
    expect(a).toMatchObject({ id: 'a', type: 'path' });
  });

  it('has nothing to do without a drawn line, or when read-only', () => {
    expect(setup([box], ['b']).result.current.canTidyUp()).toBe(false);
    const ro = setup([line('a')], ['a'], true);
    expect(ro.result.current.canTidyUp()).toBe(false);
    act(() => ro.result.current.tidyUpSelected());
    expect(ro.commit).not.toHaveBeenCalled();
  });
});
