import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiKnowledgePages } from './knowledge';
import { apiReadSavedTab } from './tabs';
import { apiFetchImageBlob } from './images';

// The reads a Markdown Folder export makes (docs/specs/020-import-export/knowledgebase-export.md "How it is built"):
// the tree with its owners' names, a page as saved, a picture's original bytes.

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineId: vi.fn(async (id: string) => id === 'offline-kb'),
  offlineLoadTab: vi.fn(async (_doc: string, tab: string) => ({
    id: tab,
    name: 'Kept',
    elements: [],
  })),
}));

type Call = { url: string; init: RequestInit };
function stub(answer: () => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(answer());
    }),
  );
  return calls;
}
const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

afterEach(() => vi.unstubAllGlobals());

describe('the export’s reads', () => {
  it('reads the tree with names=1 and the share code', async () => {
    const calls = stub(() => Response.json({ reviewEvery: '90d', pages: [], names: { u: 'Ana' } }));
    expect((await apiKnowledgePages({ ownerId: 'o', shareCode: 'S1' }, 'kb')).names).toEqual({
      u: 'Ana',
    });
    expect(calls[0]!.url).toMatch(/\/documents\/kb\/pages\?names=1$/);
    expect(header(calls[0]!, 'X-Share-Code')).toBe('S1');
  });

  it('reads a page as saved, null when it is gone, and an Offline one from this browser', async () => {
    let status = 200;
    const calls = stub(() =>
      status === 200
        ? Response.json({ tab: { id: 't 1', name: 'P', elements: [] } })
        : Response.json({ error: 'not_found' }, { status }),
    );
    expect((await apiReadSavedTab('o', 'kb', 't 1', null))!.name).toBe('P');
    expect(calls[0]!.url).toMatch(/\/documents\/kb\/tabs\/t%201$/);
    status = 404;
    expect(await apiReadSavedTab('o', 'kb', 't1', null)).toBeNull();
    expect((await apiReadSavedTab('o', 'offline-kb', 't1', null))!.name).toBe('Kept');
    expect(calls).toHaveLength(2);
  });

  it('reads a picture’s original bytes, null when refused', async () => {
    let ok = true;
    const calls = stub(() =>
      ok
        ? new Response(new Uint8Array([7]), { headers: { 'Content-Type': 'image/webp' } })
        : new Response(null, { status: 403 }),
    );
    const blob = await apiFetchImageBlob('o', 'img', { documentId: 'kb', shareCode: null });
    expect(blob!.type).toBe('image/webp');
    expect(calls[0]!.url).toMatch(/\/images\/img\?d=kb$/);
    ok = false;
    expect(await apiFetchImageBlob('o', 'img')).toBeNull();
  });
});
