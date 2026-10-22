// The invite email's Decline link calls (docs/specs/013-workspace/teams.md "Declining from the email"): no
// identity headers, a read that never declines, and a decline that names its two business answers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDeclineTeamInvite, apiReadTeamInviteDecline } from './teams';

const answer = (body: unknown, status = 200) =>
  vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }),
  );

afterEach(() => vi.unstubAllGlobals());

describe('apiReadTeamInviteDecline', () => {
  it('GETs the token, URL-encoded, with no identity headers', async () => {
    const fetchSpy = answer({ teamName: 'Design', status: 'invited' });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(apiReadTeamInviteDecline('m.a/b')).resolves.toEqual({
      teamName: 'Design',
      status: 'invited',
    });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toMatch(/\/teams\/invite-decline\/m\.a%2Fb$/);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.headers).toBeUndefined();
  });

  it('answers null for a token that names nothing', async () => {
    vi.stubGlobal('fetch', answer({ error: 'invite_not_found' }, 404));
    await expect(apiReadTeamInviteDecline('x')).resolves.toBeNull();
  });
});

describe('apiDeclineTeamInvite', () => {
  it('POSTs, and answers the invite as it now stands', async () => {
    const fetchSpy = answer({ teamName: 'Design', status: 'declined' });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(apiDeclineTeamInvite('t')).resolves.toEqual({
      teamName: 'Design',
      status: 'declined',
    });
    expect(fetchSpy.mock.calls[0]![1]?.method).toBe('POST');
  });

  it('names a joined invite and an unknown token', async () => {
    vi.stubGlobal('fetch', answer({ error: 'already_joined' }, 409));
    await expect(apiDeclineTeamInvite('t')).resolves.toBe('already_joined');
    vi.stubGlobal('fetch', answer({ error: 'invite_not_found' }, 404));
    await expect(apiDeclineTeamInvite('t')).resolves.toBeNull();
  });

  it('throws on a server failure', async () => {
    vi.stubGlobal('fetch', answer({ error: 'internal_error' }, 500));
    await expect(apiDeclineTeamInvite('t')).rejects.toThrow();
  });
});
