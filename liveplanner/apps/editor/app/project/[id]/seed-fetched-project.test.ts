// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@liveplanner/api-schema';

const apiLoadTab = vi.fn<typeof import('@/lib/api-client').apiLoadTabRevisioned>();
vi.mock('@/lib/api-client', () => ({
  apiLoadTabRevisioned: (...a: Parameters<typeof apiLoadTab>) => apiLoadTab(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { makeSeedFetchedProject } from './seed-fetched-project';

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

// docs/specs/026-plan/plan-overview.md "A plan opens on its Overview": the seed picks the tab and opens the Overview.
describe('seedFetchedProject and the Overview', () => {
  const twoTabs = {
    ...fetched,
    tabs: [
      fetched.tabs[0]!,
      { id: 't2', projectId: 'd1', name: 'Tab 2', orderIndex: 1, updatedAt: 1 },
    ],
  } satisfies Project;

  function open(
    hash: string,
    opts: { embed?: boolean; scope?: string | null; state?: unknown } = {},
  ) {
    window.history.replaceState(opts.state ?? null, '', `/project/d1${hash}`);
    const calls: string[] = [];
    const noop = vi.fn();
    const run = makeSeedFetchedProject({
      activeId: 'placeholder',
      recordOpen: true,
      resetTabs: noop,
      lastSavedTabsRef: { current: [] },
      lastSavedNameRef: { current: '' },
      loadedTabIdsRef: { current: new Set() },
      noteChangesetSeen: noop,
      setActiveId: (id) => calls.push(`tab:${String(id)}`),
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
      showOverviewOnOpen: opts.embed ? undefined : () => calls.push('overview'),
    });
    return run('me', twoTabs, null, opts.scope ?? null).then(() => calls);
  }

  it('opens a plain address on the Overview, after picking the first tab', async () => {
    expect(await open('')).toEqual(['tab:t1', 'overview']);
  });

  it('opens a link or reload naming a tab on that tab', async () => {
    expect(await open('#t=t2')).toEqual(['tab:t2']);
    expect(await open('#t=t2&item=c1')).toEqual(['tab:t2']);
  });

  it('opens #overview on the Overview', async () => {
    expect(await open('#overview')).toEqual(['tab:t1', 'overview']);
  });

  it('opens an embed and a tab-scoped session on their tab', async () => {
    expect(await open('', { embed: true })).toEqual(['tab:t1']);
    expect(await open('', { scope: 't2' })).toEqual(['tab:t2']);
  });

  it('opens a plan /new just made on its tab', async () => {
    expect(await open('', { state: { liveplannerNewPlan: true } })).toEqual(['tab:t1']);
  });
});
