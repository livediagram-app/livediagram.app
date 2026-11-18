// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openOwnAddress,
  resetGatedReopensForTests,
} from '@liveworkspace/workbench/lib/editor-arrival';

// Reopening a password-protected canvas by its own address, with no share code (docs/specs/013-workspace/share-password.md
// "Reopened by its own address", Work Tracker 1244): the index refuses the grant and names the link, so the editor
// opens the canvas through that link, with the password this browser remembers or the gate, never Not Found.
const loadOwn = vi.fn<(selfId: string, id: string) => Promise<unknown>>();
const loadShared = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const cache = new Map<string, string>();
let session: string | null = null;
vi.mock('@/lib/api-client', () => ({
  apiLoadDocument: (selfId: string, id: string) => loadOwn(selfId, id),
  apiLoadShared: (...a: unknown[]) => loadShared(...a),
  getSessionSharePassword: () => session,
  readCachedSharePassword: (code: string) => cache.get(code) ?? null,
  setSessionSharePassword: (password: string | null) => {
    session = password;
  },
  writeCachedSharePassword: (code: string, password: string | null) => {
    if (password) cache.set(code, password);
    else cache.delete(code);
  },
}));
const passwordLink = vi.fn<(id: string) => Promise<string | null>>();
vi.mock('@/lib/api/document-grants', () => ({
  documentGrant: async () => null,
  documentPasswordLink: (id: string) => passwordLink(id),
}));
vi.mock('@/lib/last-seen', () => ({
  lastSeenCopies: { remember: async () => {}, forget: async () => {} },
}));
const { DOCUMENT_ARRIVAL } = await import('./document-arrival');

const item = { id: 'i1', ownerId: 'owner' };
// The api relays the index's refusal of a grant asked with no code.
const refused = Object.assign(new Error('load failed: 401'), {
  status: 401,
  code: 'password_required',
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
    { id: 'i1', early: false, accountUserId: 'visitor' },
  );
  return { set, seed, reached };
}

beforeEach(() => {
  resetGatedReopensForTests();
  loadOwn.mockReset().mockRejectedValue(refused);
  loadShared.mockReset();
  passwordLink.mockReset().mockResolvedValue('CODE');
  cache.clear();
  session = null;
});

describe('reopening a password-protected canvas without its share code', () => {
  it('shows the password gate, never Not Found, whether the load is refused or misses', async () => {
    for (const miss of [false, true]) {
      resetGatedReopensForTests();
      if (miss) loadOwn.mockResolvedValue(null);
      loadShared.mockResolvedValue({ passwordRequired: true, invalid: false });
      const { set, reached } = reopen();
      expect(await reached).toBe(false);
      expect(passwordLink).toHaveBeenCalledWith('i1');
      expect(loadShared.mock.calls.at(-1)!.slice(0, 2)).toEqual(['CODE', 'visitor']);
      expect(set.setSharePasswordGate).toHaveBeenCalledWith({ invalid: false });
      expect(set.setNotFound).not.toHaveBeenCalled();
      expect(set.setLoadError).not.toHaveBeenCalled();
    }
  });

  it("opens straight away with the password remembered under the link's code, as its visitor", async () => {
    cache.set('CODE', 'hunter2');
    loadShared.mockResolvedValue({ document: item, role: 'view', tabId: 't1', community: null });
    const { set, seed, reached } = reopen();
    expect(await reached).toBe(true);
    expect(session).toBe('hunter2');
    expect(set.setSharePasswordGate).not.toHaveBeenCalled();
    expect(set.setIsOwner).toHaveBeenCalledWith(false);
    expect(set.setSessionRole).toHaveBeenCalledWith('view');
    expect(set.setSessionShareCode).toHaveBeenCalledWith('CODE');
    expect(set.setSessionTabScope).toHaveBeenCalledWith('t1');
    expect(seed).toHaveBeenCalledWith('visitor', item, 'CODE', 't1');
  });

  it('retries the password through the link without loading the own address again', async () => {
    loadShared.mockResolvedValueOnce({ passwordRequired: true, invalid: false });
    expect(await reopen().reached).toBe(false);
    session = 'hunter2';
    loadShared.mockResolvedValueOnce({
      document: item,
      role: 'participate',
      tabId: null,
      community: null,
    });
    const { set, reached } = reopen();
    expect(await reached).toBe(true);
    expect(loadOwn).toHaveBeenCalledOnce();
    expect(passwordLink).toHaveBeenCalledOnce();
    expect(set.setSessionShareCode).toHaveBeenCalledWith('CODE');
    // The accepted password is remembered under the link's code for the next reopen.
    expect(cache.get('CODE')).toBe('hunter2');
  });

  it('keeps Not Found for a canvas the index names no link for', async () => {
    loadOwn.mockResolvedValue(null);
    passwordLink.mockResolvedValue(null);
    const { set, reached } = reopen();
    expect(await reached).toBe(false);
    expect(set.setNotFound).toHaveBeenCalledWith(true);
    expect(loadShared).not.toHaveBeenCalled();
  });
});
