// @vitest-environment jsdom
// A card tag's colour for the tab (docs/specs/009-elements/tag-colours.md "Editing").

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

import { useTagColourSetter } from './useTagColourSetter';

const tab = (over: Partial<Tab> = {}) => ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

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
});
