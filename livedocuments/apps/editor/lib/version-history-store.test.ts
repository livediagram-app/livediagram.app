// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeVersionHistory,
  openVersionHistory,
  showVersionsOf,
  useVersionHistoryState,
  versionHistoryState,
} from './version-history-store';

// Whether Version History is open, and on which tab (docs/specs/006-document/version-history.md "In the editor").

afterEach(() => closeVersionHistory());

describe('the Version History store', () => {
  it('opens on a tab, moves to another and closes', () => {
    const { result } = renderHook(() => useVersionHistoryState());
    expect(result.current).toBeNull();
    act(() => openVersionHistory('t1'));
    expect(result.current).toEqual({ tabId: 't1' });
    act(() => showVersionsOf('t2'));
    expect(result.current).toEqual({ tabId: 't2' });
    act(() => closeVersionHistory());
    expect(result.current).toBeNull();
  });

  it('moves nothing while closed, and keeps the same state for the same tab', () => {
    showVersionsOf('t2');
    expect(versionHistoryState()).toBeNull();
    openVersionHistory('t1');
    const open = versionHistoryState();
    showVersionsOf('t1');
    expect(versionHistoryState()).toBe(open);
    closeVersionHistory();
    closeVersionHistory();
    expect(versionHistoryState()).toBeNull();
  });
});
