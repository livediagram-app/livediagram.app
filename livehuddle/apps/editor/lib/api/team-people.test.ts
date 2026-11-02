import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiNotifyMention, apiTeamMembers } from './team-people';

vi.mock('../guest-token', () => ({ readGuestToken: () => null }));

// A team's people come from the api, which reads them from the accounts Worker
// (docs/specs/012-collaboration/assigned-actions.md); the notices go to the team's own doors.
afterEach(() => vi.unstubAllGlobals());

describe('team people', () => {
  it('reads the team’s people once for concurrent asks', async () => {
    const fetchSpy = vi.fn(async (_url: string) => Response.json({ members: [{ id: 'm1' }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const [a, b] = await Promise.all([
      apiTeamMembers('guest_1', 'team 1'),
      apiTeamMembers('guest_1', 'team 1'),
    ]);
    expect(a).toEqual([{ id: 'm1' }]);
    expect(b).toBe(a);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/teams/team%201/members');
  });

  it('sends a mention notice to the team’s door', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ ok: true }, { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);
    await apiNotifyMention('guest_1', 't1', {
      documentId: 'd1',
      commentText: 'hi',
      mentions: [{ userId: 'u2' }],
    });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/teams/t1/notify-mention');
    expect(init.method).toBe('POST');
  });
});
