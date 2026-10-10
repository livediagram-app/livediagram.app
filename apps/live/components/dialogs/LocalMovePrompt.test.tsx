// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/014-identity/auth-and-guest-access.md "Moving Local only documents after signing in": offered
// once signed in when this browser holds Local only documents, every one ticked; Move syncs each in
// turn and names any that stayed; Not Now is remembered until the count grows.

const { auth, store, convert, track } = vi.hoisted(() => ({
  auth: { authLoaded: true, clerkUserId: 'user_1' as string | null },
  store: { offlineListDocuments: vi.fn(), offlineIdCount: vi.fn() },
  convert: { saveOfflineToCloud: vi.fn() },
  track: vi.fn(),
}));
vi.mock('@/hooks/persistence/useClerkApiBootstrap', () => ({ useClerkApiBootstrap: () => auth }));
vi.mock('@/lib/offline/offline-store', () => store);
vi.mock('@/lib/offline/offline-convert', () => convert);
vi.mock('@/lib/telemetry', () => ({ track }));

import { LocalMovePrompt } from './LocalMovePrompt';

const DOCS = [
  { id: 'a', name: 'Older sketch', savedAt: Date.now() - 3_600_000 },
  { id: 'b', name: 'Kanban', savedAt: Date.now() - 60_000 },
];
const reload = vi.fn();

beforeEach(() => {
  auth.authLoaded = true;
  auth.clerkUserId = 'user_1';
  store.offlineListDocuments.mockResolvedValue(DOCS);
  store.offlineIdCount.mockResolvedValue(DOCS.length);
  convert.saveOfflineToCloud.mockResolvedValue('x');
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const show = async (enabled?: boolean) => {
  render(<LocalMovePrompt enabled={enabled} />);
  await act(async () => {});
};

describe('LocalMovePrompt', () => {
  it('offers every Local only document, newest first, all ticked', async () => {
    await show();
    expect(screen.getByText('Move Local Documents to Your Account?')).toBeTruthy();
    const names = screen.getAllByRole('checkbox').slice(1);
    expect(names.map((c) => (c as HTMLInputElement).checked)).toEqual([true, true]);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Kanban'),
      expect.stringContaining('Older sketch'),
    ]);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'LocalMovePrompt');
  });

  it('stays away for a guest, before auth settles, when disabled, or with nothing local', async () => {
    auth.clerkUserId = null;
    await show();
    auth.clerkUserId = 'user_1';
    auth.authLoaded = false;
    await show();
    auth.authLoaded = true;
    await show(false);
    expect(store.offlineListDocuments).not.toHaveBeenCalled();
    store.offlineIdCount.mockResolvedValue(0);
    await show();
    // Nothing held here: the records are never read.
    expect(store.offlineListDocuments).not.toHaveBeenCalled();
    expect(screen.queryByText('Move Local Documents to Your Account?')).toBeNull();
  });

  it('moves the ticked documents into the account, then reloads', async () => {
    await show();
    fireEvent.click(screen.getByRole('checkbox', { name: /Older sketch/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    await act(async () => {});
    expect(convert.saveOfflineToCloud).toHaveBeenCalledExactlyOnceWith('b', 'user_1');
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'LocalMovePrompt');
    expect(track).toHaveBeenCalledWith('Document', 'Moved', 'SavedToCloud');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('names what stayed Local only, and reloads on Done when something moved', async () => {
    convert.saveOfflineToCloud.mockImplementation(async (id: string) => {
      if (id === 'a') throw new Error('too big');
      return id;
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toContain('could not be moved');
    expect(screen.getByText('Older sketch')).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('remembers Not Now until there are more Local only documents', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'LocalMovePrompt');
    expect(screen.queryByText('Move Local Documents to Your Account?')).toBeNull();
    cleanup();
    await show();
    expect(screen.queryByText('Move Local Documents to Your Account?')).toBeNull();
    // Not even listed while the count is no more than what was put off.
    expect(store.offlineListDocuments).toHaveBeenCalledOnce();
    store.offlineIdCount.mockResolvedValue(3);
    store.offlineListDocuments.mockResolvedValue([
      ...DOCS,
      { id: 'c', name: 'New', savedAt: Date.now() },
    ]);
    cleanup();
    await show();
    expect(screen.getByText('Move Local Documents to Your Account?')).toBeTruthy();
  });
});
