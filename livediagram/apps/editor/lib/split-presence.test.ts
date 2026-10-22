// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resetSplitPresence,
  setLocalBesideTab,
  setRemoteBesideTab,
  syncRemoteBesideTabs,
  useLocalBesideTab,
  useRemoteBesideTabs,
} from './split-presence';

// docs/specs/007-editor/split-view.md "Presence"
describe('split presence stores', () => {
  afterEach(() => resetSplitPresence());

  it('holds the tab in our other pane', () => {
    const { result } = renderHook(() => useLocalBesideTab());
    expect(result.current).toBeNull();
    act(() => setLocalBesideTab('t2'));
    expect(result.current).toBe('t2');
    act(() => setLocalBesideTab(null));
    expect(result.current).toBeNull();
  });

  it("follows each peer's beside tab from their ops and the presence list", () => {
    const { result } = renderHook(() => useRemoteBesideTabs());
    act(() => setRemoteBesideTab('a', 't3'));
    expect(result.current.get('a')).toBe('t3');
    const before = result.current;
    act(() => setRemoteBesideTab('a', 't3'));
    expect(result.current).toBe(before);
    act(() => setRemoteBesideTab('a', undefined));
    expect(result.current.has('a')).toBe(false);

    act(() =>
      syncRemoteBesideTabs(
        [{ id: 'me', besideTabId: 't9' }, { id: 'b', besideTabId: 't1' }, { id: 'c' }],
        'me',
      ),
    );
    expect([...result.current]).toEqual([['b', 't1']]);
    const synced = result.current;
    act(() => syncRemoteBesideTabs([{ id: 'b', besideTabId: 't1' }], 'me'));
    expect(result.current).toBe(synced);
  });
});
