// @vitest-environment jsdom

// The team invite link landing (docs/specs/013-workspace/teams.md): the URL's token resolves to a team
// once auth settles; a link without a token is invalid without asking the api.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamInviteJoin } from './TeamInviteJoin';
import {
  clearGuestSelfId,
  getGuestSelfId,
  getGuestSelfSig,
  setGuestIdentity,
} from '@/lib/local-identity';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true, sessionsEnabled: true }));
vi.mock('@/hooks/persistence/useClerkApiBootstrap', () => ({
  useClerkApiBootstrap: () => ({ authLoaded: true, isSignedIn: false, clerkUserId: null }),
}));
const resolve = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({
  apiResolveTeamInviteLink: resolve,
  apiJoinTeamByInviteLink: vi.fn(),
}));

// The worker's signed mint (lib/guest-identity.ts), as production answers it.
const mint = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/self', () => ({ apiMintGuestId: mint, apiUpgradeGuestId: vi.fn() }));

const visit = (search: string) => window.history.replaceState(null, '', `/join${search}`);

afterEach(() => {
  cleanup();
  resolve.mockReset();
  mint.mockReset();
  clearGuestSelfId();
});

describe('TeamInviteJoin', () => {
  it('resolves the token in the URL', async () => {
    visit('?token=abc');
    resolve.mockResolvedValue({
      team: { id: 't1', name: 'Platform', organisation: null },
      memberCount: 3,
      alreadyMember: false,
    });
    setGuestIdentity('guest', null);
    render(<TeamInviteJoin />);
    await act(async () => {});
    expect(resolve).toHaveBeenCalledWith('guest', 'abc');
    expect(screen.getByText('Platform')).toBeTruthy();
  });

  // Signed, like every entry path: once guest signatures are enforced an unsigned id is refused.
  it('mints a signed guest id for a first-time browser and resolves with it', async () => {
    visit('?token=abc');
    resolve.mockResolvedValue(null);
    mint.mockResolvedValue({ ownerId: 'signed-guest', ownerSig: 'sig' });
    expect(getGuestSelfId()).toBeNull();
    render(<TeamInviteJoin />);
    await act(async () => {});
    expect(getGuestSelfId()).toBe('signed-guest');
    expect(getGuestSelfSig()).toBe('sig');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith('signed-guest', 'abc');
  });

  it('calls a link without a token invalid, without asking', async () => {
    visit('');
    render(<TeamInviteJoin />);
    await act(async () => {});
    expect(screen.getByText(/isn.t valid/)).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('calls a token the api does not know invalid', async () => {
    visit('?token=nope');
    resolve.mockResolvedValue(null);
    render(<TeamInviteJoin />);
    await act(async () => {});
    expect(screen.getByText(/isn.t valid/)).toBeTruthy();
  });
});
