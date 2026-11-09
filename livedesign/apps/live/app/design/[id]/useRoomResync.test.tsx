// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';

// docs/specs/012-collaboration/resync-without-reload.md "The tab list": a resync reads the tab list back as well as
// the held tabs' content, so a peer's tab deleted or added during the gap shows without a reload.
const api = vi.hoisted(() => ({
  apiLoadDesign: vi.fn(),
  apiLoadShared: vi.fn(),
  apiLoadTabRevisioned: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

import { useRoomResync } from './useRoomResync';

const t = (id: string, elements: Tab['elements'] = []): Tab => ({ id, name: id, elements });
const summary = (id: string, orderIndex: number) => ({
  id,
  designId: 'd1',
  name: id.toUpperCase(),
  orderIndex,
  updatedAt: 1,
});

function setUp(shareCode: string | null) {
  let screen = [t('a'), t('gone'), t('b')];
  const lastSaved = { current: screen };
  const { result } = renderHook(() =>
    useRoomResync({
      designId: 'd1',
      selfId: 'me',
      sessionShareCode: shareCode,
      tabsRef: { current: screen },
      loadedTabIdsRef: { current: new Set(['a']) },
      applyRemoteTabs: (updater) => {
        screen = updater(screen);
      },
      lastSavedTabsRef: lastSaved,
      setTabLoadErrors: () => {},
      noteChangesetSeen: () => {},
    }),
  );
  return { resync: result.current, screen: () => screen, lastSaved };
}

describe('useRoomResync', () => {
  it("applies the stored tab list: a peer's deleted tab goes, an added one comes, both on screen and in the baseline", async () => {
    api.apiLoadTabRevisioned.mockResolvedValue({ tab: { ...t('a'), name: 'A' }, rev: 3 });
    api.apiLoadDesign.mockResolvedValue({
      id: 'd1',
      name: 'Design',
      tabs: [summary('a', 0), summary('b', 2), summary('new', 3)],
    });
    const { resync, screen, lastSaved } = setUp(null);
    await act(() => resync());
    expect(api.apiLoadDesign).toHaveBeenCalledWith('me', 'd1');
    expect(screen().map((x) => [x.id, x.name])).toEqual([
      ['a', 'A'],
      ['b', 'B'],
      ['new', 'NEW'],
    ]);
    expect(lastSaved.current.map((x) => x.id)).toEqual(['a', 'b', 'new']);
  });

  it('reads the list through the share link for a visitor, and reads none for a narrowed refetch', async () => {
    api.apiLoadDesign.mockClear();
    api.apiLoadTabRevisioned.mockResolvedValue({ tab: t('a'), rev: 3 });
    api.apiLoadShared.mockResolvedValue({
      design: { id: 'd1', name: 'Design', tabs: [summary('a', 0)] },
      role: 'view',
      tabId: null,
      community: null,
    });
    const visitor = setUp('CODE');
    await act(() => visitor.resync());
    expect(api.apiLoadShared).toHaveBeenCalledWith('CODE', 'me', 'd1');
    expect(visitor.screen().map((x) => x.id)).toEqual(['a']);

    api.apiLoadShared.mockClear();
    const narrowed = setUp('CODE');
    await act(() => narrowed.resync({ tabIds: ['a'] }));
    expect(api.apiLoadShared).not.toHaveBeenCalled();
    expect(narrowed.screen().map((x) => x.id)).toEqual(['a', 'gone', 'b']);
  });

  it('leaves the list alone when it cannot be read, and does nothing when nothing could be read', async () => {
    api.apiLoadDesign.mockRejectedValue(new Error('offline'));
    api.apiLoadTabRevisioned.mockResolvedValue({ tab: t('a'), rev: 3 });
    const listless = setUp(null);
    await act(() => listless.resync());
    expect(listless.screen().map((x) => x.id)).toEqual(['a', 'gone', 'b']);

    api.apiLoadTabRevisioned.mockRejectedValue(new Error('offline'));
    const nothing = setUp(null);
    const before = nothing.screen();
    await act(() => nothing.resync());
    expect(nothing.screen()).toBe(before);
  });
});
