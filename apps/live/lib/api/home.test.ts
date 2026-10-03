import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeResponse } from '@livediagram/api-schema';
import { apiReadHome } from './home';

// Explorer Home's reads (docs/specs/013-workspace/blueprints/explorer-home.md "Client"): null
// means "we could not ask", never an empty Home.

const EMPTY: HomeResponse = {
  jumpBackIn: [],
  whatHappened: [],
  lastSeenAt: null,
};

let warn: ReturnType<typeof vi.spyOn>;

function stub(response: () => Promise<Response>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiReadHome', () => {
  it("asks in the reader's time zone and returns what the worker said", async () => {
    const fetch = stub(async () => Response.json(EMPTY));
    expect(await apiReadHome('owner', { tz: 'Europe/Amsterdam' })).toEqual(EMPTY);
    const url = new URL(String(fetch.mock.calls[0]![0]), 'https://x.test');
    expect(url.pathname).toBe('/api/home');
    expect(url.searchParams.get('tz')).toBe('Europe/Amsterdam');
  });

  it('answers null on a refusal, a thrown fetch, or an unparseable body', async () => {
    stub(async () => Response.json({ error: 'tz_invalid' }, { status: 400 }));
    expect(await apiReadHome('owner', { tz: 'Nowhere' })).toBeNull();
    expect(warn).toHaveBeenCalledWith('[home] read failed status=400');

    stub(async () => {
      throw new TypeError('offline');
    });
    expect(await apiReadHome('owner', { tz: 'UTC' })).toBeNull();
    expect(warn).toHaveBeenCalledWith('[home] read failed status=thrown');

    stub(async () => Response.json({ ...EMPTY, lastSeenAt: 'yesterday' }));
    expect(await apiReadHome('owner', { tz: 'UTC' })).toBeNull();

    stub(async () => Response.json({ ...EMPTY, jumpBackIn: undefined }));
    expect(await apiReadHome('owner', { tz: 'UTC' })).toBeNull();

    stub(async () => new Response('<html>', { status: 200 }));
    expect(await apiReadHome('owner', { tz: 'UTC' })).toBeNull();
    expect(warn).toHaveBeenCalledWith('[home] read failed status=unparseable');
  });
});
