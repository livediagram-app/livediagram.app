// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-document/offline-mode.md "Instant open": a Local only document opens before auth
// settles, with no guest id, participant read or Explorer lists in its way; who is reading resolves
// once auth answers, without loading the document again. Anything else still waits for auth.

const { api, guest, offline, seed } = vi.hoisted(() => ({
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadDocument: vi.fn(),
    apiLoadShared: vi.fn(),
    apiListShareLinks: vi.fn(),
  },
  guest: { ensureSignedGuestIdentity: vi.fn() },
  offline: { isOfflineId: vi.fn() },
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
vi.mock('@/lib/offline/offline-store', () => ({ ...offline, OFFLINE_OWNER_ID: '__offline__' }));
vi.mock('@/lib/local-identity', () => ({
  ensureCollabKey: () => 'collab',
  hasConfirmedName: () => false,
}));
vi.mock('@/lib/daily-return', () => ({ trackDailyReturn: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./seed-fetched-document', () => ({ makeSeedFetchedDocument: () => seed }));

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { resetLoadProgressForTests } from '@/lib/load-progress';

const LOCAL_DOC = { id: 'doc-1', ownerId: '__offline__', name: 'Sketch', tabs: [{ id: 't1' }] };
const GUEST = { id: 'guest-1', name: 'Guest', color: '#111', status: 'online' };

type Props = { authLoaded: boolean };
function render(initial: Props) {
  const set = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  const lists = { documents: vi.fn(), shared: vi.fn() };
  const hook = renderHook(
    ({ authLoaded }: Props) =>
      useIdentityBootstrap({
        authLoaded,
        passwordRetry: 0,
        hydrated: false,
        clerkUserId: null,
        clerkDisplayName: null,
        embed: false,
        workbench: null,
        activeId: 't1',
        selfParticipant: { id: 'self', name: 'x', color: '#000', status: 'online' },
        refreshDocumentList: lists.documents,
        refreshSharedList: lists.shared,
        resetTabs: () => {},
        refs: {
          lastPersistedSelfRef: { current: null },
          lastSavedTabsRef: { current: [] },
          lastSavedNameRef: { current: '' },
          loadedTabIdsRef: { current: new Set() },
          noteChangesetSeen: () => {},
        },
        set: set as never,
      }),
    { initialProps: initial },
  );
  return { hook, set, lists };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetLoadProgressForTests();
  window.history.replaceState(null, '', '/document/doc-1');
  api.apiLoadDocument.mockResolvedValue(LOCAL_DOC);
  api.apiLoadSelf.mockResolvedValue(GUEST);
  api.apiSaveSelf.mockResolvedValue(undefined);
  guest.ensureSignedGuestIdentity.mockResolvedValue({ id: 'guest-1', sig: 's' });
  offline.isOfflineId.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe('useIdentityBootstrap early open', () => {
  it('opens a Local only document before auth settles, without the server', async () => {
    const { set, lists } = render({ authLoaded: false });
    await flush();
    expect(api.apiLoadDocument).toHaveBeenCalledExactlyOnceWith('self', 'doc-1');
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    expect(set.setDocumentServerStored).toHaveBeenCalledWith(false);
    expect(guest.ensureSignedGuestIdentity).not.toHaveBeenCalled();
    expect(api.apiLoadSelf).not.toHaveBeenCalled();
    expect(lists.documents).not.toHaveBeenCalled();
    // The naming nudge waits for the real participant.
    expect(set.setTemplatePickerMode).not.toHaveBeenCalled();
  });

  it('resolves the reader once auth answers, without loading the document again', async () => {
    const { hook, set, lists } = render({ authLoaded: false });
    await flush();
    hook.rerender({ authLoaded: true });
    await flush();
    expect(api.apiLoadDocument).toHaveBeenCalledOnce();
    expect(set.setSelfParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'guest-1', key: 'collab' }),
    );
    expect(lists.documents).toHaveBeenCalledWith('guest-1');
    expect(lists.shared).toHaveBeenCalledWith('guest-1');
    expect(set.setTemplatePickerMode).toHaveBeenCalledWith('identity');
  });

  it('waits for auth on a cloud document', async () => {
    offline.isOfflineId.mockResolvedValue(false);
    api.apiLoadDocument.mockResolvedValue({ ...LOCAL_DOC, ownerId: 'guest-1' });
    const { hook } = render({ authLoaded: false });
    await flush();
    expect(api.apiLoadDocument).not.toHaveBeenCalled();
    hook.rerender({ authLoaded: true });
    await flush();
    expect(api.apiLoadDocument).toHaveBeenCalledExactlyOnceWith('guest-1', 'doc-1');
  });

  it('waits for auth on a share link', async () => {
    window.history.replaceState(null, '', '/document/doc-1?s=code');
    render({ authLoaded: false });
    await flush();
    expect(offline.isOfflineId).not.toHaveBeenCalled();
    expect(api.apiLoadDocument).not.toHaveBeenCalled();
  });

  it('runs the ordinary load when auth has already answered', async () => {
    render({ authLoaded: true });
    await flush();
    expect(guest.ensureSignedGuestIdentity).toHaveBeenCalled();
    expect(api.apiLoadDocument).toHaveBeenCalledExactlyOnceWith('guest-1', 'doc-1');
  });
});
