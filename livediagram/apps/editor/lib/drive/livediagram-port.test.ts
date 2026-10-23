import { DOCUMENT_ENVELOPE_KIND, type DocumentEnvelope } from '@livediagram/document';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The Drive port (docs/specs/022-drive-mirror/blueprints/drive-mirror.md "LivediagramPort"): My Work's canvases,
// folders and Trash read from the index in full, a canvas's content from the api.

// No grant traffic: each request about a canvas goes straight to the stubbed fetch.
vi.mock('../api/document-grants', () => ({
  withDocumentGrant: async (_base: string, _input: string, init?: RequestInit) => init,
  heldDocumentGrant: () => null,
  seedDocumentGrant: () => {},
  documentGrant: async () => null,
  documentGrantRefusal: () => null,
}));
const index = vi.hoisted(() => ({
  createItem: vi.fn(async (input: { id: string; title?: string }) => ({
    item: { id: input.id, title: input.title ?? '' },
    grant: { grant: 'g', level: 'edit', tabId: null, expiresAt: Date.now() + 600_000 },
  })),
  updateItem: vi.fn(async () => ({ item: {} })),
  recordOpen: vi.fn(async () => {}),
  listItems: vi.fn(),
  listFolders: vi.fn(),
  listTrash: vi.fn(),
  getItem: vi.fn(),
}));
vi.mock('../index-client', () => ({ indexClient: index, INDEX_BASE: '/api/index' }));
const loads = vi.hoisted(() => ({ document: vi.fn(), tab: vi.fn() }));
vi.mock('../api-client', async (importActual) => ({
  ...(await importActual<typeof import('../api-client')>()),
  apiLoadDocument: loads.document,
  apiLoadTab: loads.tab,
}));

const { createApiLivediagramPort, everyPage, MIRROR_LIST_PAGES_MAX } =
  await import('./livediagram-port');

let apiPosts: number;

beforeEach(() => {
  apiPosts = 0;
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') apiPosts++;
      return new Response(JSON.stringify({ document: { id: 'new' } }), { status: 201 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const envelope = (kind?: string): DocumentEnvelope => ({
  kind: DOCUMENT_ENVELOPE_KIND,
  schemaVersion: 1,
  exportedAt: 0,
  document: {
    id: 'src',
    name: 'Board',
    presentation: null,
    tabs: [{ id: 't1', name: 'Tab 1', elements: [], ...(kind ? { kind } : {}) }],
  } as DocumentEnvelope['document'],
});

const createInput = () => index.createItem.mock.lastCall![0] as Record<string, unknown>;

// docs/specs/013-workspace/default-folders.md "Creation intent": Import a copy is an import, so it carries the first
// tab's intent and lands in the person's default folder; a copy placed by the mirror keeps the mirror's place.
describe('importDocumentCopy', () => {
  it("makes Import a copy at the index with its first tab's intent", async () => {
    await createApiLivediagramPort('owner-1').importDocumentCopy(envelope('whiteboard'));
    expect(createInput()).toMatchObject({
      app: 'livediagram',
      title: 'Board',
      intent: 'draw:diagram',
    });
    expect(createInput()).not.toHaveProperty('folderId');
    expect(apiPosts).toBe(1);
  });

  it("makes a mirror-placed copy with no intent, keeping the mirror's place", async () => {
    await createApiLivediagramPort('owner-1').importDocumentCopy(envelope(), {
      id: 'copy',
      name: 'Board',
      folderId: null,
    });
    expect(createInput()).not.toHaveProperty('intent');
    expect(createInput()).toHaveProperty('folderId', null);
    expect(createInput()).toHaveProperty('id', 'copy');
  });
});

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  app: 'livediagram',
  title: `Canvas ${id}`,
  ownerId: 'owner-1',
  teamId: null,
  folderId: null,
  createdAt: 1,
  updatedAt: 2,
  trashedAt: null,
  sharedVia: null,
  ...over,
});

describe('My Work from the index', () => {
  it('lists only My Work, every page, as the mirror reads it', async () => {
    index.listItems
      .mockResolvedValueOnce({ items: [item('a', { folderId: 'f' })], nextCursor: 'c2' })
      .mockResolvedValueOnce({
        items: [item('b', { teamId: 't' }), item('c', { sharedVia: 'CODE' })],
        nextCursor: null,
      });
    const docs = await createApiLivediagramPort('owner-1').listPersonalDocuments();
    expect(docs).toEqual([{ id: 'a', name: 'Canvas a', folderId: 'f', savedAt: 2, createdAt: 1 }]);
    expect(index.listItems).toHaveBeenCalledTimes(2);
    expect(index.listItems.mock.calls[0]![0]).toMatchObject({
      app: 'livediagram',
      team: 'personal',
    });
    expect(index.listItems.mock.calls[1]![0]).toMatchObject({ cursor: 'c2' });
  });

  it('reads the Trash and folders of My Work only', async () => {
    index.listTrash.mockResolvedValueOnce({
      items: [item('x', { trashedAt: 9 }), item('y', { trashedAt: 9, teamId: 't' })],
      nextCursor: null,
    });
    index.listFolders.mockResolvedValueOnce({
      folders: [
        { id: 'f', name: 'F', parentId: null, teamId: null, updatedAt: 3 },
        { id: 'g', name: 'G', parentId: null, teamId: 't', updatedAt: 3 },
      ],
      nextCursor: null,
    });
    const port = createApiLivediagramPort('owner-1');
    expect(await port.listPersonalTrash()).toEqual([{ id: 'x', name: 'Canvas x', trashedAt: 9 }]);
    expect(await port.listPersonalFolders()).toEqual([
      { id: 'f', name: 'F', parentId: null, updatedAt: 3 },
    ]);
  });

  // A canvas missing from the list reads as gone, and its Drive file goes with it: a cut-short list must never pass
  // for the whole.
  it('throws rather than answer part of a list too long to read', async () => {
    let reads = 0;
    const read = async () => {
      reads++;
      return { items: [item(`i${reads}`)], nextCursor: 'more' };
    };
    await expect(everyPage(read, 'items')).rejects.toThrow(/too large/);
    expect(reads).toBe(MIRROR_LIST_PAGES_MAX);
  });
});

// plan-outbound.ts uploads a canvas whose listed savedAt (the index item's last change) is past the one it last
// uploaded. A rename at the index moves the item's time without a save of the canvas: stamped with the canvas's own
// save, the upload would never catch up, and every pass would upload it again.
describe('loadEnvelope', () => {
  const canvas = { id: 'd1', name: 'Plan', presentation: null, savedAt: 5, tabs: [] };

  it("stamps the upload with the later of the canvas's save and the index item's change", async () => {
    loads.document.mockResolvedValueOnce(canvas);
    index.getItem.mockResolvedValueOnce({ item: item('d1', { updatedAt: 9 }) });
    const loaded = await createApiLivediagramPort('owner-1').loadEnvelope('d1');
    expect(loaded!.savedAt).toBe(9);
    expect((JSON.parse(loaded!.text) as { exportedAt: number }).exportedAt).toBe(9);
  });

  it("keeps the canvas's own save when the index does not answer, or is behind", async () => {
    loads.document.mockResolvedValueOnce(canvas);
    index.getItem.mockRejectedValueOnce(new Error('offline'));
    expect((await createApiLivediagramPort('owner-1').loadEnvelope('d1'))!.savedAt).toBe(5);
    loads.document.mockResolvedValueOnce(canvas);
    index.getItem.mockResolvedValueOnce({ item: item('d1', { updatedAt: 3 }) });
    expect((await createApiLivediagramPort('owner-1').loadEnvelope('d1'))!.savedAt).toBe(5);
  });

  it('answers null for a canvas that is gone, without asking the index', async () => {
    loads.document.mockResolvedValueOnce(null);
    expect(await createApiLivediagramPort('owner-1').loadEnvelope('d1')).toBeNull();
    expect(index.getItem).not.toHaveBeenCalled();
  });
});
