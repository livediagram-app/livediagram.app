// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@livehuddle/api-schema';

const apiLoadTab = vi.fn<typeof import('@/lib/api-client').apiLoadTabRevisioned>();
vi.mock('@/lib/api-client', () => ({
  apiLoadTabRevisioned: (...a: Parameters<typeof apiLoadTab>) => apiLoadTab(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { cpuBudgetMs, cpuMsOf, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import type { Tab } from '@livehuddle/document';
import { makePaintLastSeen, makeSeedFetchedDocument, type SeedDeps } from './seed-fetched-document';

// The editor's eager first-tab read is the one that counts as an open of the document, for the
// reader's Home (docs/specs/013-workspace/explorer-home.md "Opens"); an embed is not an open.

const fetched = {
  id: 'd1',
  ownerId: 'owner',
  name: 'Payments',
  tabs: [{ id: 't1', documentId: 'd1', name: 'Tab 1', orderIndex: 0, updatedAt: 1 }],
  shareable: false,
  shareCode: null,
  folderId: null,
  teamId: null,
  source: null,
  presentation: null,
  savedAt: 1,
  createdAt: 1,
  ownerName: null,
  ownerColor: null,
  opensIn: null,
  tabKind: null,
  templateFamily: null,
} satisfies LiveDoc;

function deps(recordOpen: boolean, noteChangesetSeen = vi.fn(), over: Partial<SeedDeps> = {}) {
  const noop = vi.fn();
  return {
    activeId: 't1',
    recordOpen,
    resetTabs: noop,
    lastSavedTabsRef: { current: [] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set() },
    noteChangesetSeen,
    setActiveId: noop,
    setDocumentName: noop,
    setDocumentOwnerName: noop,
    setDocumentShareable: noop,
    setDocumentShareCode: noop,
    setDocumentTeamId: noop,
    setLoadedExistingDocument: noop,
    setLoadedTabIds: noop,
    ...over,
  } satisfies SeedDeps;
}
const seed = (recordOpen: boolean, noteChangesetSeen = vi.fn()) =>
  makeSeedFetchedDocument(deps(recordOpen, noteChangesetSeen));

beforeEach(() => {
  apiLoadTab.mockReset();
  apiLoadTab.mockResolvedValue({ tab: { id: 't1', name: 'Tab 1', elements: [] }, rev: 6 });
});

describe('seedFetchedDocument', () => {
  it("declares the editor's first-tab read an open", async () => {
    await seed(true)('me', fetched, 'CODE', null);
    expect(apiLoadTab).toHaveBeenCalledWith('me', 'd1', 't1', 'CODE', { open: true });
  });

  it('declares nothing for an embed', async () => {
    await seed(false)('me', fetched, 'CODE', null);
    expect(apiLoadTab).toHaveBeenCalledWith('me', 'd1', 't1', 'CODE', { open: false });
  });
});

// docs/specs/024-agents/agent-changesets.md "The editor": the first tab's load records what it holds.
describe('seedFetchedDocument and changesets', () => {
  it('records the first tab revision as seen', async () => {
    const noteChangesetSeen = vi.fn();
    await seed(true, noteChangesetSeen)('me', fetched, null, null);
    expect(noteChangesetSeen).toHaveBeenCalledWith('t1', 6);
  });

  // The last seen copy keeps the tab it painted (offline-mode.md "Warm open of a cloud document").
  it('answers the first tab it painted, and nothing when the fetch failed', async () => {
    expect(await seed(true)('me', fetched, null, null)).toEqual({
      id: 't1',
      rev: 6,
      tab: { id: 't1', name: 'Tab 1', elements: [] },
    });
    apiLoadTab.mockRejectedValueOnce(new Error('down'));
    expect(await seed(true)('me', fetched, null, null)).toBeNull();
  });
});

// offline-mode.md "Warm open of a cloud document": the copy is painted as a load is shown, then replaced in place.
describe('the warm open', () => {
  const warmTab = { id: 't1', name: 'Tab 1', elements: [{ id: 'e1' }] } as unknown as Tab;
  const second = { id: 't2', documentId: 'd1', name: 'Tab 2', orderIndex: 1, updatedAt: 1 };
  const copy: LastSeenCopy<LiveDoc, unknown> = {
    reader: 'me',
    itemId: 'd1',
    seenAt: 1,
    item: { ...fetched, tabs: [...fetched.tabs, second] },
    firstTab: { id: 't1', rev: 6, tab: warmTab },
    via: null,
    access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  };
  const tabsOf = (reset: ReturnType<typeof vi.fn>, call = 0) => reset.mock.calls[call]![0] as Tab[];

  it('paints the copy: its tabs, the first one filled, its name, nothing fetched, loaded or saved', () => {
    const resetTabs = vi.fn();
    const setDocumentName = vi.fn();
    const setActiveId = vi.fn();
    const setLoadedTabIds = vi.fn();
    const noteChangesetSeen = vi.fn();
    const lastSavedTabsRef = { current: [] as Tab[] };
    const over = { resetTabs, setDocumentName, setActiveId, setLoadedTabIds, lastSavedTabsRef };
    makePaintLastSeen(deps(true, noteChangesetSeen, over))(copy);
    const tabs = tabsOf(resetTabs);
    expect(tabs.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(tabs[0]).toBe(warmTab);
    expect(tabs[1]!.elements).toEqual([]);
    expect(setDocumentName).toHaveBeenCalledWith('Payments');
    expect(setActiveId).toHaveBeenCalledWith('t1');
    expect(apiLoadTab).not.toHaveBeenCalled();
    // The load that catches up marks the tab loaded and seeds the autosave's baseline.
    expect(setLoadedTabIds).not.toHaveBeenCalled();
    expect(noteChangesetSeen).not.toHaveBeenCalled();
    expect(lastSavedTabsRef.current).toEqual([]);
  });

  it('paints a tab-scoped copy on its one tab, and an empty first tab when it kept none', () => {
    const resetTabs = vi.fn();
    const setActiveId = vi.fn();
    const scoped = {
      ...copy,
      firstTab: { id: 't2', rev: 1, tab: warmTab },
      access: { ...copy.access, tabScope: 't2' },
    };
    makePaintLastSeen(deps(true, vi.fn(), { resetTabs, setActiveId }))(scoped);
    expect(setActiveId).toHaveBeenCalledWith('t2');
    expect(tabsOf(resetTabs)[1]).toBe(warmTab);
    makePaintLastSeen(deps(true, vi.fn(), { resetTabs }))({ ...copy, firstTab: null });
    expect(tabsOf(resetTabs, 1)[0]!.elements).toEqual([]);
  });

  it('keeps the painted tab when the fresh read is at its revision, so the canvas is not drawn again', async () => {
    const resetTabs = vi.fn();
    const catchUp = makeSeedFetchedDocument(
      deps(true, vi.fn(), { resetTabs, warmFirstTab: () => copy.firstTab }),
    );
    expect(await catchUp('me', fetched, null, null)).toEqual({ id: 't1', rev: 6, tab: warmTab });
    expect(tabsOf(resetTabs)[0]).toBe(warmTab);
  });

  it('replaces the painted tab with the fresh one when the document moved on', async () => {
    const resetTabs = vi.fn();
    apiLoadTab.mockResolvedValue({ tab: { id: 't1', name: 'Tab 1', elements: [] }, rev: 7 });
    await makeSeedFetchedDocument(
      deps(true, vi.fn(), { resetTabs, warmFirstTab: () => copy.firstTab }),
    )('me', fetched, null, null);
    expect(tabsOf(resetTabs)[0]).not.toBe(warmTab);
    expect(tabsOf(resetTabs)[0]!.elements).toEqual([]);
  });

  // A person who moved to another tab while the warm open showed stays there when the load catches up.
  it('keeps the tab the person moved to when the catch-up shows the document', async () => {
    const setActiveId = vi.fn();
    const twoTabs = { ...fetched, tabs: [...fetched.tabs, second] };
    await makeSeedFetchedDocument(deps(true, vi.fn(), { setActiveId, keepActiveId: () => 't2' }))(
      'me',
      twoTabs,
      null,
      null,
    );
    expect(setActiveId).toHaveBeenLastCalledWith('t2');
    // Over the address's pin too: the pin is what the person left, the kept tab is where they went.
    window.location.hash = '#t=t1';
    makePaintLastSeen(deps(true, vi.fn(), { setActiveId, keepActiveId: () => 't2' }))(copy);
    expect(setActiveId).toHaveBeenLastCalledWith('t2');
    window.location.hash = '';
  });

  it('falls back to the first tab when the kept tab is gone or outside the link scope', () => {
    const setActiveId = vi.fn();
    makePaintLastSeen(deps(true, vi.fn(), { setActiveId, keepActiveId: () => 'gone' }))(copy);
    expect(setActiveId).toHaveBeenLastCalledWith('t1');
    makePaintLastSeen(deps(true, vi.fn(), { setActiveId, keepActiveId: () => null }))(copy);
    expect(setActiveId).toHaveBeenLastCalledWith('t1');
    const scoped = {
      ...copy,
      firstTab: { id: 't2', rev: 1, tab: warmTab },
      access: { ...copy.access, tabScope: 't2' },
    };
    makePaintLastSeen(deps(true, vi.fn(), { setActiveId, keepActiveId: () => 't1' }))(scoped);
    expect(setActiveId).toHaveBeenLastCalledWith('t2');
  });

  // The warm paint and its catch-up, on a 200-tab document whose first tab holds 2,000 elements.
  it('paints and catches up a large document cheaply (100 of each within budget)', async () => {
    const elements = Array.from({ length: 2000 }, (_, i) => ({ id: `e${i}`, type: 'shape' }));
    const big = { id: 't0', name: 'Tab 0', elements } as unknown as Tab;
    const tabs = Array.from({ length: 200 }, (_, i) => ({ ...second, id: `t${i}`, orderIndex: i }));
    const large = { ...copy, item: { ...fetched, tabs }, firstTab: { id: 't0', rev: 6, tab: big } };
    apiLoadTab.mockResolvedValue({ tab: big, rev: 6 });
    const paint = makePaintLastSeen(deps(true));
    const paintMs = cpuMsOf(() => {
      for (let i = 0; i < 100; i += 1) paint(large);
    });
    const catchUp = makeSeedFetchedDocument(
      deps(true, vi.fn(), { warmFirstTab: () => large.firstTab }),
    );
    const catchUpMs = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 100; i += 1) await catchUp('me', large.item, null, null);
    });
    expect(paintMs).toBeLessThan(cpuBudgetMs(100));
    expect(catchUpMs).toBeLessThan(cpuBudgetMs(200));
  });
});
