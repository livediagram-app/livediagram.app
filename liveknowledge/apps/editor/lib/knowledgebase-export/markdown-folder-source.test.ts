import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgePagesResponse } from '@liveknowledge/api-schema';
import type { Tab } from '@liveknowledge/document';
import {
  dataPicture,
  folderPagesOf,
  markdownFolderSource,
  offersMarkdownFolder,
  offlinePagesOf,
} from './markdown-folder-source';

// The editor's pages for a Markdown Folder export (docs/specs/020-import-export/knowledgebase-export.md "Where it is
// offered", "Who sees what", "How it is built").

vi.mock('@/lib/api/knowledge', () => ({ apiKnowledgePages: vi.fn() }));
vi.mock('@/lib/api/tabs', () => ({ apiReadSavedTab: vi.fn() }));
vi.mock('@/lib/api/images', () => ({ apiFetchImageBlob: vi.fn() }));
const { apiKnowledgePages } = await import('@/lib/api/knowledge');
const { apiReadSavedTab } = await import('@/lib/api/tabs');
const { apiFetchImageBlob } = await import('@/lib/api/images');

afterEach(() => vi.clearAllMocks());

const trust = { state: 'never-verified', stale: false } as const;
const LISTED: KnowledgePagesResponse = {
  reviewEvery: '90d' as never,
  pages: [
    {
      tab: 'a',
      title: 'Alpha',
      depth: 1,
      subpages: 1,
      owner: 'user_o',
      updatedAt: 5,
      labels: ['Ops'],
      trust: { ...trust, state: 'verified', verifiedAt: 4 } as never,
    },
    { tab: 'b', title: 'Beta', depth: 2, parent: 'a', subpages: 0, owner: 'user_x', trust },
    { tab: 'c', title: 'Plan', kind: 'connected', app: 'liveplanner', depth: 1, subpages: 0 },
  ],
  names: { user_o: 'Olu' },
};
const tab = (id: string, extra: object = {}) =>
  ({ id, name: id.toUpperCase(), elements: [], ...extra }) as unknown as Tab;

describe('who is offered it', () => {
  it('every role reading the whole knowledgebase; never a link confined to one page or an open with no reader', () => {
    // An Editor, a Participant and a Viewer read the whole knowledgebase alike: the role is not asked.
    expect(offersMarkdownFolder({ documentId: 'kb', ownerId: 'u', tabScope: null })).toBe(true);
    expect(offersMarkdownFolder({ documentId: 'kb', ownerId: 'u', tabScope: 'a' })).toBe(false);
    expect(offersMarkdownFolder({ documentId: 'kb', ownerId: 'self', tabScope: null })).toBe(false);
    expect(offersMarkdownFolder({ documentId: null, ownerId: 'u', tabScope: null })).toBe(false);
  });
});

describe('the pages', () => {
  it('takes the api’s tree, connected files out, each owner by name where it has one', () => {
    expect(folderPagesOf(LISTED)).toEqual([
      {
        id: 'a',
        title: 'Alpha',
        facts: { owner: 'Olu', updated: 5, verified: 4, labels: ['Ops'] },
      },
      { id: 'b', title: 'Beta', parent: 'a', facts: {} },
    ]);
    const { names: _names, ...unnamed } = LISTED;
    void _names;
    expect(folderPagesOf(unnamed)[0]!.facts!.owner).toBeUndefined();
  });

  it('takes an Offline knowledgebase’s own list, with what it knows', () => {
    expect(
      offlinePagesOf([
        tab('a', { knowledge: { verifiedAt: 3 } }),
        tab('b', { parent: 'a' }),
        tab('c', { connection: { app: 'liveplanner' } }),
      ]),
    ).toEqual([
      { id: 'a', title: 'A', facts: { verified: 3 } },
      { id: 'b', title: 'B', parent: 'a' },
    ]);
  });
});

describe('the source', () => {
  it('reads a page this editor holds from what it holds, any other as saved, with the caller’s credentials', async () => {
    vi.mocked(apiKnowledgePages).mockResolvedValue(LISTED);
    vi.mocked(apiReadSavedTab).mockResolvedValue(tab('b'));
    const held = tab('a');
    const source = await markdownFolderSource({
      documentId: 'kb',
      ownerId: 'u',
      shareCode: 'S1',
      offline: false,
      tabs: [held, tab('b')],
      loaded: new Set(['a']),
    });
    expect(apiKnowledgePages).toHaveBeenCalledWith(
      { ownerId: 'u', shareCode: 'S1' },
      'kb',
      undefined,
    );
    expect(source.pages.map((p) => p.id)).toEqual(['a', 'b']);
    expect(await source.readPage('a')).toBe(held);
    expect((await source.readPage('b'))!.id).toBe('b');
    expect(apiReadSavedTab).toHaveBeenCalledTimes(1);
    expect(apiReadSavedTab).toHaveBeenCalledWith('u', 'kb', 'b', 'S1', undefined);
  });

  it('asks no api for an Offline knowledgebase', async () => {
    const source = await markdownFolderSource({
      documentId: 'off',
      ownerId: 'u',
      shareCode: null,
      offline: true,
      tabs: [tab('a')],
      loaded: new Set(),
    });
    expect(apiKnowledgePages).not.toHaveBeenCalled();
    expect(source.pages).toEqual([{ id: 'a', title: 'A' }]);
  });

  it('reads a picture’s bytes and type, a data picture from its id, and none when the api has none', async () => {
    vi.mocked(apiKnowledgePages).mockResolvedValue({ ...LISTED, pages: [] });
    const source = await markdownFolderSource({
      documentId: 'kb',
      ownerId: 'u',
      shareCode: null,
      offline: false,
      tabs: [],
      loaded: new Set(),
    });
    vi.mocked(apiFetchImageBlob).mockResolvedValueOnce(
      new Blob([new Uint8Array([1, 2])], { type: 'image/png' }),
    );
    expect(await source.readPicture('img')).toEqual({
      bytes: new Uint8Array([1, 2]),
      type: 'image/png',
    });
    expect(apiFetchImageBlob).toHaveBeenCalledWith('u', 'img', {
      documentId: 'kb',
      shareCode: null,
    });
    vi.mocked(apiFetchImageBlob).mockResolvedValueOnce(null);
    expect(await source.readPicture('gone')).toBeNull();
    expect(await source.readPicture('data:image/gif;base64,AQI=')).toEqual({
      bytes: new Uint8Array([1, 2]),
      type: 'image/gif',
    });
  });

  it('takes only a base64 raster as a data picture', () => {
    expect(dataPicture('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(dataPicture('data:image/png,raw')).toBeNull();
  });
});
