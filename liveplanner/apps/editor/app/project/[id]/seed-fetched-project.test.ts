// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@liveplanner/api-schema';

const apiLoadTab = vi.fn<typeof import('@/lib/api-client').apiLoadTabRevisioned>();
vi.mock('@/lib/api-client', () => ({
  apiLoadTabRevisioned: (...a: Parameters<typeof apiLoadTab>) => apiLoadTab(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { makePaintLastSeen, makeSeedFetchedProject } from './seed-fetched-project';
import type { SeedDeps } from './seed-fetched-project';

// The editor's eager first-tab read is the one that counts as an open of the project, for the
// reader's Home (docs/specs/013-workspace/explorer-home.md "Opens"); an embed is not an open.

const fetched = {
  id: 'd1',
  ownerId: 'owner',
  name: 'Payments',
  tabs: [{ id: 't1', projectId: 'd1', name: 'Tab 1', orderIndex: 0, updatedAt: 1 }],
  shareable: false,
  shareCode: null,
  folderId: null,
  teamId: null,
  source: null,
  savedAt: 1,
  createdAt: 1,
  ownerName: null,
  ownerColor: null,
  opensIn: null,
  tabKind: null,
  templateFamily: null,
} satisfies Project;

function seed(recordOpen: boolean, noteChangesetSeen = vi.fn()) {
  const noop = vi.fn();
  return makeSeedFetchedProject({
    activeId: 't1',
    recordOpen,
    resetTabs: noop,
    lastSavedTabsRef: { current: [] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set() },
    noteChangesetSeen,
    setActiveId: noop,
    setProjectName: noop,
    setProjectItemTypes: noop,
    setProjectOwnerColor: noop,
    setProjectOwnerId: noop,
    setProjectOwnerName: noop,
    setProjectShareable: noop,
    setProjectShareCode: noop,
    setProjectTeamId: noop,
    setLoadedExistingProject: noop,
    setLoadedTabIds: noop,
  });
}

beforeEach(() => {
  apiLoadTab.mockReset();
  apiLoadTab.mockResolvedValue({ tab: { id: 't1', name: 'Tab 1', elements: [] }, rev: 6 });
});

describe('seedFetchedProject', () => {
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
describe('seedFetchedProject and changesets', () => {
  it('records the first tab revision as seen', async () => {
    const noteChangesetSeen = vi.fn();
    await seed(true, noteChangesetSeen)('me', fetched, null, null);
    expect(noteChangesetSeen).toHaveBeenCalledWith('t1', 6);
  });
});

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": the seed answers the first tab it painted, for
// the copy; keeps the warm-painted tab when the fresh read is at its revision and the tab the person moved to; and the
// paint shows a copy the way the seed shows a load, fetching and counting nothing.
describe('seedFetchedProject and the warm open', () => {
  const deps = (over: Partial<SeedDeps> = {}) => {
    const noop = vi.fn();
    return {
      activeId: 't1',
      recordOpen: true,
      resetTabs: vi.fn(),
      lastSavedTabsRef: { current: [] },
      lastSavedNameRef: { current: '' },
      loadedTabIdsRef: { current: new Set<string>() },
      noteChangesetSeen: noop,
      setActiveId: vi.fn(),
      setProjectName: noop,
      setProjectItemTypes: noop,
      setProjectOwnerColor: noop,
      setProjectOwnerId: noop,
      setProjectOwnerName: noop,
      setProjectShareable: noop,
      setProjectShareCode: noop,
      setProjectTeamId: noop,
      setLoadedExistingProject: noop,
      setLoadedTabIds: noop,
      ...over,
    };
  };
  const two = {
    ...fetched,
    tabs: [
      ...fetched.tabs,
      { id: 't2', projectId: 'd1', name: 'Tab 2', orderIndex: 1, updatedAt: 1 },
    ],
  };

  it('answers the first tab it painted, and none when the read failed', async () => {
    expect(await makeSeedFetchedProject(deps())('me', fetched, null, null)).toEqual({
      id: 't1',
      rev: 6,
      tab: { id: 't1', name: 'Tab 1', elements: [] },
    });
    apiLoadTab.mockRejectedValueOnce(new Error('offline'));
    expect(await makeSeedFetchedProject(deps())('me', fetched, null, null)).toBeNull();
  });

  it('keeps the warm-painted tab at an unchanged revision, and the tab the person moved to', async () => {
    const warm = { id: 't1', rev: 6, tab: { id: 't1', name: 'Tab 1', elements: ['kept'] } };
    const d = deps({ warmFirstTab: () => warm, keepActiveId: () => 't2' });
    const painted = await makeSeedFetchedProject(d)('me', two, null, null);
    expect(painted?.tab).toBe(warm.tab);
    expect(d.setActiveId).toHaveBeenCalledWith('t2');
  });

  it('paints a copy as the seed shows a load, its first tab from the copy, reading nothing', () => {
    const resetTabs = vi.fn();
    const d = deps({ resetTabs });
    const tab = { id: 't1', name: 'Tab 1', elements: ['a'] };
    makePaintLastSeen(d)({
      reader: 'me',
      itemId: 'd1',
      seenAt: 1,
      item: two,
      firstTab: { id: 't1', rev: 3, tab },
      via: null,
      access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
    });
    expect(apiLoadTab).not.toHaveBeenCalled();
    const shown = resetTabs.mock.calls[0]![0] as { id: string }[];
    expect(shown[0]).toBe(tab);
    expect(shown.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(d.setActiveId).toHaveBeenCalledWith('t1');
    expect(d.loadedTabIdsRef.current.size).toBe(0);
  });

  it('paints a copy with no first tab kept as placeholders', () => {
    const resetTabs = vi.fn();
    const d = deps({ resetTabs });
    makePaintLastSeen(d)({
      reader: 'me',
      itemId: 'd1',
      seenAt: 1,
      item: fetched,
      firstTab: null,
      via: null,
      access: { role: 'view', isOwner: false, sessionShareCode: 'C', tabScope: null },
    });
    expect((resetTabs.mock.calls[0]![0] as { elements: unknown[] }[])[0]!.elements).toEqual([]);
  });
});
