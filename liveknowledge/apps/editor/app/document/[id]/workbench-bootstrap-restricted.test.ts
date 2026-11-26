import { beforeEach, describe, expect, it, vi } from 'vitest';

// A workspace frame opening a document by its link (workbench-bootstrap.ts): the document's sign-in rule turning the
// person away shows the restricted page, and the password this browser remembers for the link stays (the rule
// refused the person, not it). A wrong remembered password is still forgotten.

const api = vi.hoisted(() => ({
  apiLoadDocument: vi.fn(),
  apiLoadSelf: vi.fn(async () => null),
  apiLoadShared: vi.fn(),
  getSessionSharePassword: vi.fn(() => null),
  readCachedSharePassword: vi.fn(() => 'kept'),
  setSessionSharePassword: vi.fn(),
  writeCachedSharePassword: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);
vi.mock('@/lib/load-progress', () => ({ setLoadStep: vi.fn() }));
vi.mock('@/lib/local-identity', () => ({ ensureCollabKey: () => 'key' }));

const { loadWorkbenchDocument } = await import('./workbench-bootstrap');

function run() {
  const set = {
    setSelfParticipant: vi.fn(),
    setDocumentId: vi.fn(),
    setDocumentTrashed: vi.fn(),
    setLoadError: vi.fn(),
    setDocumentNotFound: vi.fn(),
    setDocumentServerStored: vi.fn(),
    setSessionRole: vi.fn(),
    setIsOwner: vi.fn(),
    setNameConfirmed: vi.fn(),
    setHydrated: vi.fn(),
    setLoadingDocument: vi.fn(),
    setSessionShareCode: vi.fn(),
    setSessionTabScope: vi.fn(),
    setSharePasswordGate: vi.fn(),
  };
  const done = loadWorkbenchDocument({
    workbench: {
      documentId: 'D1',
      tabId: null,
      level: 'edit',
      person: { id: 'u1', name: 'Bob', color: '#000' },
      shareCode: 'CODE1',
    } as never,
    seed: vi.fn(async () => {}),
    lastPersistedSelfRef: { current: null },
    set,
  });
  return { set, done };
}

beforeEach(() => vi.clearAllMocks());

describe('loadWorkbenchDocument by a link', () => {
  it('shows the restricted page and keeps the remembered password', async () => {
    api.apiLoadShared.mockResolvedValue({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'domain', domains: ['acme.com'] },
    });
    const { set, done } = run();
    await done;
    expect(set.setSharePasswordGate).toHaveBeenCalledWith({
      invalid: false,
      restricted: { reason: 'domain', domains: ['acme.com'] },
    });
    expect(api.writeCachedSharePassword).not.toHaveBeenCalled();
    expect(set.setDocumentNotFound).not.toHaveBeenCalled();
  });

  it('forgets a remembered password the link refused', async () => {
    api.apiLoadShared.mockResolvedValue({ passwordRequired: true, invalid: true });
    const { set, done } = run();
    await done;
    expect(set.setSharePasswordGate).toHaveBeenCalledWith({ invalid: true });
    expect(api.writeCachedSharePassword).toHaveBeenCalledWith('CODE1', null);
  });

  it('says not found for a link that opens nothing', async () => {
    api.apiLoadShared.mockResolvedValue(null);
    const { set, done } = run();
    await done;
    expect(set.setDocumentNotFound).toHaveBeenCalledWith(true);
    expect(set.setSharePasswordGate).not.toHaveBeenCalled();
  });
});
