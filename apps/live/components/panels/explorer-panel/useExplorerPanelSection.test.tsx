// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { panelSectionGroups } from './panel-sections';
import { PANEL_SECTION_STORAGE_KEY, useExplorerPanelSection } from './useExplorerPanelSection';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

// docs/specs/013-workspace/explorer-structure.md "The rail": the pick is remembered for this viewer.
const groups = panelSectionGroups({ teams: [], hasBrowserDocuments: true });

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  track.mockReset();
});

describe('useExplorerPanelSection', () => {
  it('opens on Home, then remembers a pick', () => {
    const { result, unmount } = renderHook(() => useExplorerPanelSection(groups));
    expect(result.current[0]).toEqual({ kind: 'home' });
    act(() => result.current[1]({ kind: 'timeline' }));
    expect(result.current[0]).toEqual({ kind: 'timeline' });
    expect(localStorage.getItem(PANEL_SECTION_STORAGE_KEY)).toBe('timeline');
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'ExplorerPanel.Timeline');
    unmount();
    const again = renderHook(() => useExplorerPanelSection(groups));
    expect(again.result.current[0]).toEqual({ kind: 'timeline' });
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useExplorerPanelSection(groups));
    expect(result.current[0]).toEqual({ kind: 'home' });
    act(() => result.current[1]({ kind: 'trash' }));
    expect(result.current[0]).toEqual({ kind: 'trash' });
  });
});
