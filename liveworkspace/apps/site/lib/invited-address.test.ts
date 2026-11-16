// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetInvitedAddress,
  INVITED_ADDRESS_KEY,
  invitedAddress,
  takeInviteFromAddress,
} from './invited-address';

// Work Tracker 1006: the invitation email's link carries the invitation's token, never the address. Signed out, the
// Explorer's Invites reads the address with it and keeps it for the sign-up form; the token leaves the address bar.

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

describe('takeInviteFromAddress', () => {
  it('signed out, reads the invited address with the token, keeps it for the tab and clears the bar', async () => {
    window.history.replaceState(null, '', '/explorer/invites?invite=m1.secret&x=1#top');
    reply({ teamName: 'Design', status: 'invited', email: 'bea@example.com' });
    await takeInviteFromAddress(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/invitations/decline/m1.secret',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/explorer/invites?x=1#top',
    );
    expect(invitedAddress()).toBe('bea@example.com');
    forgetInvitedAddress();
    expect(invitedAddress()).toBeNull();
  });

  it('signed in, only clears the bar and asks nothing', async () => {
    window.history.replaceState(null, '', '/explorer/invites?invite=m1.secret');
    await takeInviteFromAddress(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(invitedAddress()).toBeNull();
  });

  it('keeps nothing for an answered or unknown invitation, an odd answer or a token of another shape', async () => {
    for (const answer of [
      { body: { teamName: 'Design', status: 'declined' } },
      { body: { error: 'invite_not_found' }, status: 404 },
      { body: { status: 'invited', email: 42 } },
      { body: { status: 'invited', email: 'not-an-address' } },
      { body: { status: 'invited', email: `${'a'.repeat(400)}@x.com` } },
    ]) {
      window.history.replaceState(null, '', '/explorer/invites?invite=m1.secret');
      reply(answer.body, answer.status);
      await takeInviteFromAddress(true);
      expect(invitedAddress()).toBeNull();
    }
    window.history.replaceState(null, '', '/explorer/invites?invite=%3Cscript%3E');
    await takeInviteFromAddress(true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(window.location.search).toBe('');
  });

  it('does nothing on a page opened without a token', async () => {
    window.history.replaceState(null, '', '/explorer/invites');
    await takeInviteFromAddress(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('invitedAddress', () => {
  it('reads only an address-shaped value', () => {
    sessionStorage.setItem(INVITED_ADDRESS_KEY, 'nope');
    expect(invitedAddress()).toBeNull();
    sessionStorage.setItem(INVITED_ADDRESS_KEY, 'bea@example.com');
    expect(invitedAddress()).toBe('bea@example.com');
  });

  it('reads null, and keeps and forgets nothing, where storage is blocked', async () => {
    const blocked = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      expect(invitedAddress()).toBeNull();
      expect(() => forgetInvitedAddress()).not.toThrow();
      window.history.replaceState(null, '', '/explorer/invites?invite=m1.secret');
      reply({ status: 'invited', email: 'bea@example.com' });
      await expect(takeInviteFromAddress(true)).resolves.toBeUndefined();
    } finally {
      blocked.mockRestore();
    }
    expect(invitedAddress()).toBeNull();
  });
});
