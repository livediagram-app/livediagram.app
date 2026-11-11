import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiListAttendance } from './attendance';

vi.mock('../guest-token', () => ({ readGuestToken: () => null }));

// docs/specs/012-collaboration/tab-attendance.md "The wire": the tab's own route, through the session's share link.
afterEach(() => vi.unstubAllGlobals());

describe('the Attendance client', () => {
  it('reads a tab’s visits through its share link', async () => {
    const body = { visits: [], retentionDays: 90, perTabMax: 500 };
    const fetchSpy = vi.fn(async () => Response.json(body));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await apiListAttendance('guest_1', 'doc 1', 'tab/1', 'CODE')).toEqual(body);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/documents/doc%201/tabs/tab%2F1/attendance');
    expect(new Headers(init.headers).get('X-Share-Code')).toBe('CODE');
  });

  it('throws on a refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'forbidden' }, { status: 403 })),
    );
    await expect(apiListAttendance('guest_1', 'd', 't')).rejects.toBeTruthy();
  });
});
