import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';

// Mock the api-client boundary so the test exercises only the pure
// remapping logic inside duplicateDesign, not the network.
vi.mock('./api-client', () => ({
  apiLoadDesign: vi.fn(),
  apiLoadTab: vi.fn(),
  apiCreateDesign: vi.fn(),
}));

import { apiCreateDesign, apiLoadDesign, apiLoadTab } from './api-client';
import { ApiError } from './api/core';
import { duplicateDesign } from './duplicate-design';

const mLoadDesign = vi.mocked(apiLoadDesign);
const mLoadTab = vi.mocked(apiLoadTab);
const mCreate = vi.mocked(apiCreateDesign);

// Minimal LiveDoc-ish stub: duplicateDesign only reads id, name, tabs.
const sourceDesign = (tabs: { id: string }[]) =>
  ({ id: 'src', name: 'Flow', tabs }) as Awaited<ReturnType<typeof apiLoadDesign>>;

const tab = (id: string, elements: Tab['elements'] = []): Tab => ({
  id,
  name: `Tab ${id}`,
  elements,
});

const linkedShape = (id: string, targetTabId: string) => ({
  id,
  type: 'shape' as const,
  shape: 'square' as const,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  link: { kind: 'tab' as const, tabId: targetTabId },
});

beforeEach(() => {
  vi.clearAllMocks();
  mCreate.mockResolvedValue({} as Awaited<ReturnType<typeof apiCreateDesign>>);
});

describe('duplicateDesign', () => {
  it('returns undefined when the source design cannot be loaded', async () => {
    mLoadDesign.mockResolvedValue(null);
    expect(await duplicateDesign('owner', 'missing')).toBeUndefined();
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('returns undefined when the source load rejects', async () => {
    mLoadDesign.mockRejectedValue(new Error('network'));
    expect(await duplicateDesign('owner', 'src')).toBeUndefined();
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('creates a copy with a fresh id and a " copy" suffixed name', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1'));

    const newId = await duplicateDesign('owner', 'src');

    expect(mCreate).toHaveBeenCalledTimes(1);
    const [owner, payload] = mCreate.mock.calls[0]!;
    expect(owner).toBe('owner');
    expect(payload.name).toBe('Flow copy');
    expect(payload.id).toBe(newId);
    expect(payload.id).not.toBe('src');
  });

  it('mints a fresh id for every copied tab (no reuse of source ids)', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }, { id: 't2' }]));
    mLoadTab.mockImplementation((_o, _d, tabId) => Promise.resolve(tab(tabId)));

    await duplicateDesign('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const newIds = payload.tabs!.map((t) => t.id);
    expect(newIds).toHaveLength(2);
    expect(newIds).not.toContain('t1');
    expect(newIds).not.toContain('t2');
    expect(new Set(newIds).size).toBe(2); // distinct
  });

  it('rewrites cross-tab link.tabId references to the new tab ids', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }, { id: 't2' }]));
    // t1 has a shape linking to t2; that link must follow the copy.
    mLoadTab.mockImplementation((_o, _d, tabId) =>
      Promise.resolve(tabId === 't1' ? tab('t1', [linkedShape('s1', 't2')]) : tab('t2')),
    );

    await duplicateDesign('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const copiedT1 = payload.tabs!.find((t) => t.name === 'Tab t1')!;
    const copiedT2 = payload.tabs!.find((t) => t.name === 'Tab t2')!;
    const link = (copiedT1.elements[0] as { link: { tabId: string } }).link;
    // The link now points at t2's NEW id, not the original 't2'.
    expect(link.tabId).toBe(copiedT2.id);
    expect(link.tabId).not.toBe('t2');
  });

  it('leaves a link untouched when it points outside the duplicated set', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1', [linkedShape('s1', 'external-tab')]));

    await duplicateDesign('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const link = (payload.tabs![0]!.elements[0] as { link: { tabId: string } }).link;
    expect(link.tabId).toBe('external-tab');
  });

  it('skips tabs that failed to load but still copies the ones that succeeded', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }, { id: 't2' }]));
    mLoadTab.mockImplementation((_o, _d, tabId) =>
      Promise.resolve(tabId === 't1' ? tab('t1') : null),
    );

    await duplicateDesign('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    expect(payload.tabs).toHaveLength(1);
    expect(payload.tabs![0]!.name).toBe('Tab t1');
  });

  it('returns the new id even when a single tab fetch rejects', async () => {
    mLoadDesign.mockResolvedValue(sourceDesign([{ id: 't1' }]));
    mLoadTab.mockRejectedValue(new Error('tab fetch failed'));

    const newId = await duplicateDesign('owner', 'src');
    expect(typeof newId).toBe('string');
    // The one tab failed → copy has no tabs, but creation still attempted.
    expect(mCreate.mock.calls[0]![1].tabs).toHaveLength(0);
  });
});

// Duplicate (docs/specs/013-workspace/default-folders.md "Duplicate"): beside its source, always an
// explicit placement, recording the source's recorded intent unchanged, never routed by a default.
describe('duplicateDesign placement and recorded intent', () => {
  const placed = (over: Record<string, unknown>) =>
    ({
      ...sourceDesign([{ id: 't1' }]),
      teamId: null,
      folderId: null,
      opensIn: null,
      tabKind: null,
      ...over,
    }) as Awaited<ReturnType<typeof apiLoadDesign>>;

  beforeEach(() => {
    mLoadTab.mockResolvedValue(tab('t1'));
  });

  it('creates the copy in the given team folder in the one create', async () => {
    mLoadDesign.mockResolvedValue(placed({}));
    await duplicateDesign('owner', 'src', { teamId: 'team-1', folderId: 'tf1' });
    expect(mCreate).toHaveBeenCalledTimes(1);
    expect(mCreate.mock.calls[0]![1]).toMatchObject({ teamId: 'team-1', folderId: 'tf1' });
  });

  it('files the copy beside its source when no placement is given', async () => {
    mLoadDesign.mockResolvedValue(placed({ folderId: 'f-plans' }));
    await duplicateDesign('owner', 'src');
    expect(mCreate.mock.calls[0]![1]).toMatchObject({ teamId: null, folderId: 'f-plans' });
  });

  it('sends a source at the root as the explicit root, so no default routes it', async () => {
    mLoadDesign.mockResolvedValue(placed({}));
    await duplicateDesign('owner', 'src');
    expect(mCreate.mock.calls[0]![1]).toHaveProperty('folderId', null);
  });

  it("records the source's recorded intent, unchanged", async () => {
    mLoadDesign.mockResolvedValue(placed({ opensIn: 'pages', tabKind: 'diagram' }));
    await duplicateDesign('owner', 'src');
    expect(mCreate.mock.calls[0]![1].intent).toEqual({
      mode: 'pages',
      tabKind: 'diagram',
    });
  });

  it('sends no intent for a source whose intent is unknown', async () => {
    mLoadDesign.mockResolvedValue(placed({}));
    await duplicateDesign('owner', 'src');
    expect(mCreate.mock.calls[0]![1]).not.toHaveProperty('intent');
  });

  it("files the copy at the explicit root when its source's place is refused", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mLoadDesign.mockResolvedValue(placed({ teamId: 'team-x' }));
    mCreate.mockRejectedValueOnce(new ApiError('create design', 403, 'team_forbidden'));
    expect(await duplicateDesign('owner', 'src')).toBeDefined();
    expect(mCreate).toHaveBeenCalledTimes(2);
    expect(mCreate.mock.calls[1]![1]).toMatchObject({ teamId: null, folderId: null });
    expect(warn).toHaveBeenCalledWith(
      '[duplicate] placement refused reason=team_forbidden, filed at the root',
    );
    warn.mockRestore();
  });

  it('gives up on any other failure', async () => {
    mLoadDesign.mockResolvedValue(placed({}));
    mCreate.mockRejectedValueOnce(new ApiError('create design', 500, null));
    expect(await duplicateDesign('owner', 'src')).toBeUndefined();
    expect(mCreate).toHaveBeenCalledTimes(1);
  });
});
