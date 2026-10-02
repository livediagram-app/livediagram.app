import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// Mock the api-client boundary so the test exercises only the pure
// remapping logic inside duplicateDocument, not the network.
vi.mock('./api-client', () => ({
  apiLoadDocument: vi.fn(),
  apiLoadTab: vi.fn(),
  apiCreateDocument: vi.fn(),
}));

import { apiCreateDocument, apiLoadDocument, apiLoadTab } from './api-client';
import { duplicateDocument } from './duplicate-document';

const mLoadDocument = vi.mocked(apiLoadDocument);
const mLoadTab = vi.mocked(apiLoadTab);
const mCreate = vi.mocked(apiCreateDocument);

// Minimal LiveDoc-ish stub: duplicateDocument only reads id, name, tabs.
const sourceDocument = (tabs: { id: string }[]) =>
  ({ id: 'src', name: 'Flow', tabs }) as Awaited<ReturnType<typeof apiLoadDocument>>;

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
  mCreate.mockResolvedValue({} as Awaited<ReturnType<typeof apiCreateDocument>>);
});

describe('duplicateDocument', () => {
  it('returns undefined when the source document cannot be loaded', async () => {
    mLoadDocument.mockResolvedValue(null);
    expect(await duplicateDocument('owner', 'missing')).toBeUndefined();
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('returns undefined when the source load rejects', async () => {
    mLoadDocument.mockRejectedValue(new Error('network'));
    expect(await duplicateDocument('owner', 'src')).toBeUndefined();
    expect(mCreate).not.toHaveBeenCalled();
  });

  it('creates a copy with a fresh id and a " copy" suffixed name', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1'));

    const newId = await duplicateDocument('owner', 'src');

    expect(mCreate).toHaveBeenCalledTimes(1);
    const [owner, payload] = mCreate.mock.calls[0]!;
    expect(owner).toBe('owner');
    expect(payload.name).toBe('Flow copy');
    expect(payload.id).toBe(newId);
    expect(payload.id).not.toBe('src');
  });

  it('mints a fresh id for every copied tab (no reuse of source ids)', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }, { id: 't2' }]));
    mLoadTab.mockImplementation((_o, _d, tabId) => Promise.resolve(tab(tabId)));

    await duplicateDocument('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const newIds = payload.tabs!.map((t) => t.id);
    expect(newIds).toHaveLength(2);
    expect(newIds).not.toContain('t1');
    expect(newIds).not.toContain('t2');
    expect(new Set(newIds).size).toBe(2); // distinct
  });

  it('rewrites cross-tab link.tabId references to the new tab ids', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }, { id: 't2' }]));
    // t1 has a shape linking to t2; that link must follow the copy.
    mLoadTab.mockImplementation((_o, _d, tabId) =>
      Promise.resolve(tabId === 't1' ? tab('t1', [linkedShape('s1', 't2')]) : tab('t2')),
    );

    await duplicateDocument('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const copiedT1 = payload.tabs!.find((t) => t.name === 'Tab t1')!;
    const copiedT2 = payload.tabs!.find((t) => t.name === 'Tab t2')!;
    const link = (copiedT1.elements[0] as { link: { tabId: string } }).link;
    // The link now points at t2's NEW id, not the original 't2'.
    expect(link.tabId).toBe(copiedT2.id);
    expect(link.tabId).not.toBe('t2');
  });

  it('leaves a link untouched when it points outside the duplicated set', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1', [linkedShape('s1', 'external-tab')]));

    await duplicateDocument('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    const link = (payload.tabs![0]!.elements[0] as { link: { tabId: string } }).link;
    expect(link.tabId).toBe('external-tab');
  });

  it('skips tabs that failed to load but still copies the ones that succeeded', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }, { id: 't2' }]));
    mLoadTab.mockImplementation((_o, _d, tabId) =>
      Promise.resolve(tabId === 't1' ? tab('t1') : null),
    );

    await duplicateDocument('owner', 'src');

    const payload = mCreate.mock.calls[0]![1];
    expect(payload.tabs).toHaveLength(1);
    expect(payload.tabs![0]!.name).toBe('Tab t1');
  });

  it('returns the new id even when a single tab fetch rejects', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }]));
    mLoadTab.mockRejectedValue(new Error('tab fetch failed'));

    const newId = await duplicateDocument('owner', 'src');
    expect(typeof newId).toBe('string');
    // The one tab failed → copy has no tabs, but creation still attempted.
    expect(mCreate.mock.calls[0]![1].tabs).toHaveLength(0);
  });
});

describe('duplicateDocument placement (docs/specs/013-workspace/team-shared-documents.md)', () => {
  it('creates the copy in the given team folder in the one create', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1'));
    await duplicateDocument('owner', 'src', { teamId: 'team-1', folderId: 'tf1' });
    expect(mCreate).toHaveBeenCalledTimes(1);
    expect(mCreate.mock.calls[0]![1]).toMatchObject({ teamId: 'team-1', folderId: 'tf1' });
  });

  it('creates a personal copy at the root when no placement is given', async () => {
    mLoadDocument.mockResolvedValue(sourceDocument([{ id: 't1' }]));
    mLoadTab.mockResolvedValue(tab('t1'));
    await duplicateDocument('owner', 'src');
    expect(mCreate.mock.calls[0]![1]).not.toHaveProperty('teamId');
  });
});
