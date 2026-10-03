// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@livediagram/api-schema';

const apiLoadTab = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiLoadTab: (...a: unknown[]) => apiLoadTab(...a) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { makeSeedFetchedDocument } from './seed-fetched-document';

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

function seed(recordOpen: boolean) {
  const noop = vi.fn();
  return makeSeedFetchedDocument({
    activeId: 't1',
    recordOpen,
    resetTabs: noop,
    lastSavedTabsRef: { current: [] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set() },
    setActiveId: noop,
    setDocumentName: noop,
    setDocumentPresentation: noop,
    setDocumentOwnerColor: noop,
    setDocumentOwnerId: noop,
    setDocumentOwnerName: noop,
    setDocumentShareable: noop,
    setDocumentShareCode: noop,
    setDocumentTeamId: noop,
    setLoadedExistingDocument: noop,
    setLoadedTabIds: noop,
  });
}

beforeEach(() => {
  apiLoadTab.mockReset();
  apiLoadTab.mockResolvedValue({ id: 't1', name: 'Tab 1', elements: [] });
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
