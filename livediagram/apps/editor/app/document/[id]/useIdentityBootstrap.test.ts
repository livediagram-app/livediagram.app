// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchDocumentSession } from '@/components/providers/workbench-session-context';

// The editor's load in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor
// in a workbench", I9): no guest migration or guest identity, no participant write, no Explorer lists,
// no share-link read, the session's level, the session's tab; the address is never read.

const { api, guest, seed } = vi.hoisted(() => ({
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadDocument: vi.fn(),
    apiLoadShared: vi.fn(),
  },
  guest: { ensureGuestIdentity: vi.fn() },
  seed: vi.fn(async () => {}),
}));
vi.mock('@/lib/api-client', () => ({
  ...api,
  getSessionSharePassword: () => null,
  readCachedSharePassword: () => null,
  setSessionSharePassword: () => {},
  writeCachedSharePassword: () => {},
}));
vi.mock('@/lib/guest-identity', () => guest);
vi.mock('@/lib/daily-return', () => ({ trackDailyReturn: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./seed-fetched-document', () => ({ makeSeedFetchedDocument: () => seed }));

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { resetLoadProgressForTests } from '@/lib/load-progress';
import { DocumentTrashedError } from '@/lib/document-trashed';

const PERSON = { id: 'user_1', name: 'Webber', color: '#0ea5e9' };
const DOC = {
  id: 'doc-1',
  ownerId: 'user_1',
  name: 'Home screen',
  tabs: [{ id: 't1' }, { id: 't2' }],
};

function workbenchOf(over: Partial<WorkbenchDocumentSession> = {}): WorkbenchDocumentSession {
  return {
    scope: 'document',
    secret: `lvw_${'a'.repeat(43)}.${'0f'.repeat(32)}`,
    documentId: 'doc-1',
    tabId: null,
    shareCode: null,
    frame: null,
    origin: 'https://127.0.0.1:5175',
    level: 'edit',
    expiresAt: Date.now() + 60_000,
    person: PERSON,
    workbenchName: 'Acme Editor',
    port: { origin: 'https://127.0.0.1:5175', send: vi.fn(), subscribe: vi.fn(), close: vi.fn() },
    ended: null,
    end: vi.fn(),
    ...over,
  };
}

function run(workbench: WorkbenchDocumentSession) {
  const set = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  const lastPersistedSelfRef = { current: null as { name: string; color: string } | null };
  renderHook(() =>
    useIdentityBootstrap({
      authLoaded: true,
      passwordRetry: 0,
      hydrated: false,
      accountUserId: PERSON.id,
      accountDisplayName: PERSON.name,
      embed: false,
      workbench,
      activeId: 't1',
      selfParticipant: { id: 'self', name: 'x', color: '#000', status: 'online' },
      resetTabs: () => {},
      refs: {
        lastPersistedSelfRef,
        lastSavedTabsRef: { current: [] },
        lastSavedNameRef: { current: '' },
        loadedTabIdsRef: { current: new Set() },
        noteChangesetSeen: () => {},
      },
      set: set as never,
    }),
  );
  return { set, lastPersistedSelfRef };
}

beforeEach(() => {
  resetLoadProgressForTests();
  // An address the workbench branch must not read: another document, a share code.
  window.history.replaceState(null, '', '/document/other-doc?s=SHARE123');
  api.apiLoadSelf.mockResolvedValue({ id: 'user_1', name: 'Stored', color: '#111' });
  api.apiLoadDocument.mockResolvedValue(DOC);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useIdentityBootstrap in a workbench', () => {
  it('loads the session’s document as the person, writing nothing and listing nothing', async () => {
    const { set, lastPersistedSelfRef } = run(workbenchOf());

    await vi.waitFor(() => expect(set.setHydrated).toHaveBeenCalledWith(true));

    expect(api.apiLoadSelf).toHaveBeenCalledWith('user_1');
    expect(api.apiLoadDocument).toHaveBeenCalledWith('user_1', 'doc-1');
    expect(api.apiSaveSelf).not.toHaveBeenCalled();
    expect(api.apiLoadShared).not.toHaveBeenCalled();
    expect(guest.ensureGuestIdentity).not.toHaveBeenCalled();
    expect(set.setSelfParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_1', name: 'Stored', status: 'online' }),
    );
    expect(lastPersistedSelfRef.current).toEqual({ name: 'Stored', color: '#111' });
    expect(set.setDocumentId).toHaveBeenCalledWith('doc-1');
    expect(set.setDocumentServerStored).toHaveBeenCalledWith(true);
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    expect(set.setSessionRole).toHaveBeenCalledWith('edit');
    expect(set.setNameConfirmed).toHaveBeenCalledWith(true);
    expect(set.setIdentityPromptOpen).not.toHaveBeenCalled();
    expect(set.setSessionShareCode).not.toHaveBeenCalled();
    expect(set.setLoadingDocument).toHaveBeenCalledWith(false);
    expect(seed).toHaveBeenCalledWith('user_1', DOC, null, null);
  });

  it('takes the session’s level', async () => {
    const { set } = run(workbenchOf({ level: 'view' }));

    await vi.waitFor(() => expect(set.setSessionRole).toHaveBeenCalledWith('view'));
  });

  it('opens the session’s tab first when the document has it', async () => {
    run(workbenchOf({ tabId: 't2' }));
    await vi.waitFor(() => expect(seed).toHaveBeenCalledWith('user_1', DOC, null, 't2'));
  });

  it('ignores a tab the document does not have', async () => {
    run(workbenchOf({ tabId: 'gone' }));
    await vi.waitFor(() => expect(seed).toHaveBeenCalledWith('user_1', DOC, null, null));
  });

  it('shows the person under a random name when they have no record, and still writes none', async () => {
    api.apiLoadSelf.mockRejectedValue(new Error('offline'));
    const { set } = run(workbenchOf({ person: { id: 'user_1', name: null, color: null } }));

    await vi.waitFor(() => expect(set.setHydrated).toHaveBeenCalledWith(true));

    expect(set.setSelfParticipant!.mock.calls[0]![0]).toMatchObject({
      id: 'user_1',
      name: expect.any(String),
      color: expect.any(String),
    });
    expect(api.apiSaveSelf).not.toHaveBeenCalled();
  });

  it('names a person without a stored record by the session', async () => {
    api.apiLoadSelf.mockResolvedValue(null);
    const { set } = run(workbenchOf());

    await vi.waitFor(() => expect(set.setHydrated).toHaveBeenCalledWith(true));

    expect(set.setSelfParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Webber', color: '#0ea5e9' }),
    );
  });

  it('shows the document missing when the load finds none', async () => {
    api.apiLoadDocument.mockResolvedValue(null);
    const { set } = run(workbenchOf());

    await vi.waitFor(() => expect(set.setDocumentNotFound).toHaveBeenCalledWith(true));
    expect(set.setHydrated).toHaveBeenCalledWith(true);
  });

  it('shows the deleted card for a trashed document, the load error otherwise', async () => {
    api.apiLoadDocument.mockRejectedValue(new DocumentTrashedError('doc-1'));
    const trashed = run(workbenchOf());
    await vi.waitFor(() => expect(trashed.set.setDocumentTrashed).toHaveBeenCalledWith(true));

    api.apiLoadDocument.mockRejectedValue(new Error('offline'));
    const failed = run(workbenchOf());
    await vi.waitFor(() => expect(failed.set.setLoadError).toHaveBeenCalledWith(true));
    expect(failed.set.setDocumentTrashed).not.toHaveBeenCalled();
  });
});

describe('useIdentityBootstrap in a workspace frame, a document shared with the person', () => {
  const SHARED = { ...DOC, ownerId: 'user_2' };

  it('opens it by its link, at the lower of the link’s role and the session’s level', async () => {
    api.apiLoadShared.mockResolvedValue({
      document: SHARED,
      role: 'edit',
      tabId: null,
      community: null,
    });
    const { set } = run(workbenchOf({ scope: 'workspace', shareCode: 'CODE2345', level: 'view' }));

    await vi.waitFor(() => expect(set.setHydrated).toHaveBeenCalledWith(true));

    expect(api.apiLoadShared).toHaveBeenCalledWith('CODE2345', 'user_1');
    expect(api.apiLoadDocument).not.toHaveBeenCalled();
    expect(seed).toHaveBeenCalledWith('user_1', SHARED, 'CODE2345', null);
    expect(set.setSessionShareCode).toHaveBeenCalledWith('CODE2345');
    expect(set.setIsOwner).toHaveBeenCalledWith(false);
    expect(set.setSessionRole).toHaveBeenCalledWith('view');
  });

  it('keeps a view link a view, and opens a scoped link on its tab', async () => {
    api.apiLoadShared.mockResolvedValue({
      document: SHARED,
      role: 'view',
      tabId: 't2',
      community: null,
    });
    const { set } = run(workbenchOf({ scope: 'workspace', shareCode: 'CODE2345', tabId: 't1' }));

    await vi.waitFor(() => expect(set.setHydrated).toHaveBeenCalledWith(true));

    expect(set.setSessionRole).toHaveBeenCalledWith('view');
    expect(set.setSessionTabScope).toHaveBeenCalledWith('t2');
    expect(seed).toHaveBeenCalledWith('user_1', SHARED, 'CODE2345', 't2');
  });

  it('asks for a link’s password, and finds a dead link missing', async () => {
    api.apiLoadShared.mockResolvedValue({ passwordRequired: true, invalid: false });
    const asked = run(workbenchOf({ scope: 'workspace', shareCode: 'CODE2345' }));
    await vi.waitFor(() =>
      expect(asked.set.setSharePasswordGate).toHaveBeenCalledWith({ invalid: false }),
    );
    expect(asked.set.setHydrated).not.toHaveBeenCalled();

    api.apiLoadShared.mockResolvedValue(null);
    const gone = run(workbenchOf({ scope: 'workspace', shareCode: 'GONE2345' }));
    await vi.waitFor(() => expect(gone.set.setDocumentNotFound).toHaveBeenCalledWith(true));
  });

  it('finds a link that opens another document than the frame asked for missing', async () => {
    api.apiLoadShared.mockResolvedValue({
      document: { ...SHARED, id: 'doc-9' },
      role: 'edit',
      tabId: null,
      community: null,
    });
    const { set } = run(workbenchOf({ scope: 'workspace', shareCode: 'CODE2345' }));

    await vi.waitFor(() => expect(set.setDocumentNotFound).toHaveBeenCalledWith(true));
    expect(seed).not.toHaveBeenCalled();
  });
});
