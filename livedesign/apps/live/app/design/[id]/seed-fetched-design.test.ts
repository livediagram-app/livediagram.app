// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@livedesign/api-schema';

const apiLoadTab = vi.fn<typeof import('@/lib/api-client').apiLoadTabRevisioned>();
vi.mock('@/lib/api-client', () => ({
  apiLoadTabRevisioned: (...a: Parameters<typeof apiLoadTab>) => apiLoadTab(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { makeSeedFetchedDesign } from './seed-fetched-design';

// The editor's eager first-tab read is the one that counts as an open of the design, for the
// reader's Home (docs/specs/013-workspace/explorer-home.md "Opens"); an embed is not an open.

const fetched = {
  id: 'd1',
  ownerId: 'owner',
  name: 'Payments',
  tabs: [{ id: 't1', designId: 'd1', name: 'Tab 1', orderIndex: 0, updatedAt: 1 }],
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
} satisfies LiveDoc;

function seed(recordOpen: boolean, noteChangesetSeen = vi.fn()) {
  const noop = vi.fn();
  return makeSeedFetchedDesign({
    activeId: 't1',
    recordOpen,
    resetTabs: noop,
    lastSavedTabsRef: { current: [] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set() },
    noteChangesetSeen,
    setActiveId: noop,
    setDesignName: noop,
    setDesignPresentation: noop,
    setDesignOwnerColor: noop,
    setDesignOwnerId: noop,
    setDesignOwnerName: noop,
    setDesignShareable: noop,
    setDesignShareCode: noop,
    setDesignTeamId: noop,
    setLoadedExistingDesign: noop,
    setLoadedTabIds: noop,
  });
}

beforeEach(() => {
  apiLoadTab.mockReset();
  apiLoadTab.mockResolvedValue({ tab: { id: 't1', name: 'Tab 1', elements: [] }, rev: 6 });
});

describe('seedFetchedDesign', () => {
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
describe('seedFetchedDesign and changesets', () => {
  it('records the first tab revision as seen', async () => {
    const noteChangesetSeen = vi.fn();
    await seed(true, noteChangesetSeen)('me', fetched, null, null);
    expect(noteChangesetSeen).toHaveBeenCalledWith('t1', 6);
  });
});
