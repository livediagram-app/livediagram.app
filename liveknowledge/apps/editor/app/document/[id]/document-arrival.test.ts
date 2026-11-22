// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@liveknowledge/api-schema';
import type { GrantResponse } from '@liveworkspace/index-client';
import { openOwnAddress } from '@liveworkspace/workbench/lib/editor-arrival';

// Reopening a shared document by its own address, with no share code (docs/specs/013-workspace/share-roles.md
// "Reopening without the code keeps the link's level"): the index's grant still names the link, so the editor opens
// the visitor at the link's level, tab and code, never as Editing for saves the api would refuse.
const apiLoadDocument = vi.fn<typeof import('@/lib/api-client').apiLoadDocument>();
vi.mock('@/lib/api-client', () => ({
  apiLoadDocument: (...a: Parameters<typeof apiLoadDocument>) => apiLoadDocument(...a),
  apiLoadShared: vi.fn(),
  getSessionSharePassword: () => null,
  readCachedSharePassword: () => null,
  setSessionSharePassword: () => {},
  writeCachedSharePassword: () => {},
}));
const documentGrant = vi.fn<(id: string) => Promise<GrantResponse | null>>();
vi.mock('@/lib/api/document-grants', () => ({
  documentGrant: (id: string) => documentGrant(id),
  documentPasswordLink: async () => null,
}));
vi.mock('@/lib/last-seen', () => ({
  lastSeenCopies: { remember: async () => {}, forget: async () => {} },
}));
const { DOCUMENT_ARRIVAL } = await import('./document-arrival');

const doc = { id: 'd1', ownerId: 'owner' } as LiveDoc;
const grant = (over: Partial<GrantResponse>): GrantResponse => ({
  grant: 'jwt',
  level: 'edit',
  tabId: null,
  expiresAt: Date.now() + 600_000,
  ...over,
});

function reopen() {
  const set = {
    setItemId: vi.fn(),
    setNotFound: vi.fn(),
    setLoadError: vi.fn(),
    setTrashed: vi.fn(),
    setServerStored: vi.fn(),
    setHydrated: vi.fn(),
    setIsOwner: vi.fn(),
    setLoading: vi.fn(),
    setNameConfirmed: vi.fn(),
    setSessionRole: vi.fn(),
    setSessionShareCode: vi.fn(),
    setSessionCommunity: vi.fn(),
    setSessionTabScope: vi.fn(),
    setSharePasswordGate: vi.fn(),
    setIdentityPromptOpen: vi.fn(),
  };
  const seed = vi.fn(async () => null);
  const reached = openOwnAddress(
    DOCUMENT_ARRIVAL,
    { self: { id: 'visitor' }, seed, set },
    { id: 'd1', early: false, accountUserId: 'visitor' },
  );
  return { set, seed, reached };
}

beforeEach(() => {
  apiLoadDocument.mockReset().mockResolvedValue(doc);
  documentGrant.mockReset();
});

describe('reopening a shared document without its share code', () => {
  it('opens a Viewer link visitor as Viewing, carrying the link on every write', async () => {
    documentGrant.mockResolvedValue(grant({ level: 'view', link: 'code1' }));
    const { set, seed, reached } = reopen();
    expect(await reached).toBe(true);
    expect(set.setSessionRole).toHaveBeenCalledWith('view');
    expect(set.setSessionRole).not.toHaveBeenCalledWith('edit');
    expect(set.setIsOwner).toHaveBeenCalledWith(false);
    expect(set.setSessionShareCode).toHaveBeenCalledWith('code1');
    expect(seed).toHaveBeenCalledWith('visitor', doc, 'code1', null);
  });

  it('opens a tab-scoped Participant link on its tab', async () => {
    documentGrant.mockResolvedValue(grant({ level: 'participate', tabId: 't2', link: 'code2' }));
    const { set, seed, reached } = reopen();
    await reached;
    expect(set.setSessionRole).toHaveBeenCalledWith('participate');
    expect(set.setSessionTabScope).toHaveBeenCalledWith('t2');
    expect(seed).toHaveBeenCalledWith('visitor', doc, 'code2', 't2');
  });

  it("opens an Editor link visitor as Editing without the owner's chrome", async () => {
    documentGrant.mockResolvedValue(grant({ level: 'edit', link: 'code3' }));
    const { set, reached } = reopen();
    await reached;
    expect(set.setSessionRole).toHaveBeenCalledWith('edit');
    expect(set.setIsOwner).toHaveBeenCalledWith(false);
    expect(set.setSessionShareCode).toHaveBeenCalledWith('code3');
  });

  it('still opens the owner as the owner, with no code', async () => {
    documentGrant.mockResolvedValue(grant({ level: 'edit' }));
    const { set, seed, reached } = reopen();
    await reached;
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    expect(set.setSessionRole).toHaveBeenCalledWith('edit');
    expect(set.setSessionShareCode).not.toHaveBeenCalled();
    expect(seed).toHaveBeenCalledWith('visitor', doc, null, null);
  });
});
