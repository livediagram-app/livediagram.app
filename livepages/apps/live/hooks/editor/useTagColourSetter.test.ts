// @vitest-environment jsdom
// A card tag's colour for the tab (docs/specs/009-elements/tag-colours.md "Editing").

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livepages/document';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

import { useTagColourSetter } from './useTagColourSetter';

const tab = (over: Partial<Tab> = {}) => ({ id: 't', name: 'T', elements: [], ...over });

function setter(activeTab: Tab, canEdit = true) {
  // The commit keeps its updater to run later, as React may.
  const updaters: ((ts: Tab[]) => Tab[])[] = [];
  const commitTabs = vi.fn((fn: (ts: Tab[]) => Tab[]) => void updaters.push(fn));
  const { result } = renderHook(() => useTagColourSetter({ activeTab, canEdit, commitTabs }));
  return { set: result.current, commitTabs, updaters };
}

describe('useTagColourSetter', () => {
  it('commits a new colour and reports it, even when the commit runs later', () => {
    track.mockClear();
    const { set, updaters } = setter(tab());
    set('Bug', '#dc2626');
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'TagColour');
    const [after] = updaters[0]!([tab()]);
    expect(after!.tagColours).toEqual([{ tag: 'Bug', color: '#dc2626' }]);
  });

  it('reports a clear, and skips a write that changes nothing or comes from a viewer', () => {
    track.mockClear();
    const mapped = tab({ tagColours: [{ tag: 'Bug', color: '#dc2626' }] });
    const a = setter(mapped);
    a.set('bug', '#DC2626');
    expect(a.commitTabs).not.toHaveBeenCalled();
    a.set('Bug', null);
    expect(track).toHaveBeenLastCalledWith('Element', 'Changed', 'TagColourCleared');
    const viewer = setter(tab(), false);
    viewer.set('Bug', '#dc2626');
    expect(viewer.commitTabs).not.toHaveBeenCalled();
  });

  // It reaches the menus through the editor context: one setter for every edit of the tab, not a new one per edit.
  it('stays the same setter while the tab changes, and reads the tab as it is now', () => {
    track.mockClear();
    const commitTabs = vi.fn();
    const { result, rerender } = renderHook(
      ({ t }: { t: Tab }) => useTagColourSetter({ activeTab: t, canEdit: true, commitTabs }),
      { initialProps: { t: tab() } },
    );
    const first = result.current;
    rerender({ t: tab({ tagColours: [{ tag: 'Bug', color: '#dc2626' }] }) });
    expect(result.current).toBe(first);
    // The newer tab already has it, so nothing is written.
    result.current('Bug', '#dc2626');
    expect(commitTabs).not.toHaveBeenCalled();
  });
});
