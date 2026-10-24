import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type InternalItemHandlers } from './internal';

afterEach(() => vi.restoreAllMocks());

const KEY = 'k';
const send = (
  method: string,
  path: string,
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  options: {
    key?: string | undefined;
    auth?: string;
    waitUntil?: (p: Promise<unknown>) => void;
  } = {},
) =>
  handleInternalItems(
    new Request(`https://app.test${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.auth ?? KEY}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    {
      key: 'key' in options ? options.key : KEY,
      handlers: { purge: async () => {}, ...handlers },
      ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}),
    },
  );

describe('handleInternalItems', () => {
  it('is a 404 without a key, and a 401 with the wrong one', async () => {
    expect(
      (await send('DELETE', '/api/internal/items/A', undefined, {}, { key: undefined })).status,
    ).toBe(404);
    expect(
      (await send('DELETE', '/api/internal/items/A', undefined, {}, { auth: 'nope' })).status,
    ).toBe(401);
  });

  it('purges one item', async () => {
    const purge = vi.fn(async () => {});
    const res = await send('DELETE', '/api/internal/items/A', undefined, { purge });
    expect(res.status).toBe(200);
    expect(purge).toHaveBeenCalledWith('A');
  });

  it('purges many at once, bounded, and names the unreached', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const purge = vi.fn(async (id: string) => {
      if (id === 'B') throw new Error('down');
    });
    const res = await send(
      'POST',
      '/api/internal/items/purge',
      { ids: ['A', 'B', 'A'] },
      { purge },
    );
    expect(await res.json()).toEqual({ ok: false, purged: ['A'], unreached: ['B'] });
    expect(purge).toHaveBeenCalledTimes(2);
    const tooMany = Array.from({ length: 101 }, (_, i) => `i${i}`);
    expect(
      (await send('POST', '/api/internal/items/purge', { ids: tooMany }, { purge })).status,
    ).toBe(400);
  });

  it('revokes codes, with the reason', async () => {
    const revoke = vi.fn(async () => 3);
    const res = await send(
      'POST',
      '/api/internal/items/A/revoke',
      { codes: ['c1'], reason: 'rescoped' },
      { revoke },
    );
    expect(await res.json()).toEqual({ ok: true, closed: 3 });
    expect(revoke).toHaveBeenCalledWith('A', ['c1'], 'rescoped');
    expect(
      (await send('POST', '/api/internal/items/A/revoke', { codes: 'c1' }, { revoke })).status,
    ).toBe(400);
  });

  it('takes a notice at once and works it out off the path', async () => {
    const pending: Promise<unknown>[] = [];
    const notice = vi.fn(async () => {});
    const res = await send(
      'POST',
      '/api/internal/items/A/notices',
      { type: 'joined', personId: 'user_1', level: 'view' },
      { notice },
      { waitUntil: (p) => pending.push(p) },
    );
    expect(res.status).toBe(202);
    await Promise.all(pending);
    expect(notice).toHaveBeenCalledWith('A', { type: 'joined', personId: 'user_1', level: 'view' });
    expect(
      (await send('POST', '/api/internal/items/A/notices', { type: 'x' }, { notice })).status,
    ).toBe(400);
  });

  it('copies, answering a missing source and a conflict', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let seen: unknown = null;
    const ok = await send(
      'POST',
      '/api/internal/items/A/copy-to/B',
      { tabId: 't' },
      {
        copy: async (_f, _t, tab, copier) => {
          seen = copier;
          return { tabs: tab ? 1 : 2, items: 0 };
        },
      },
    );
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ ok: true, tabs: 1, items: 0 });
    // An index that does not say who copies leaves them null.
    expect(seen).toEqual({ by: null, code: null, ip: null });
    await send(
      'POST',
      '/api/internal/items/A/copy-to/B',
      { by: 'user_b', code: 'abc123', tabId: null, ip: '2001:db8::1' },
      {
        copy: async (_f, _t, _tab, copier) => {
          seen = copier;
          return { tabs: 1, items: 0 };
        },
      },
    );
    expect(seen).toEqual({ by: 'user_b', code: 'abc123', ip: '2001:db8::1' });
    // Anything but an address is no address.
    await send(
      'POST',
      '/api/internal/items/A/copy-to/B',
      { by: 'user_b', ip: '<script>' },
      {
        copy: async (_f, _t, _tab, copier) => {
          seen = copier;
          return { tabs: 1, items: 0 };
        },
      },
    );
    expect(seen).toEqual({ by: 'user_b', code: null, ip: null });
    expect(
      (await send('POST', '/api/internal/items/A/copy-to/B', {}, { copy: async () => 'not_found' }))
        .status,
    ).toBe(404);
    const conflict = await send(
      'POST',
      '/api/internal/items/A/copy-to/B',
      {},
      {
        copy: async () => {
          throw new Error('UNIQUE');
        },
      },
    );
    expect(conflict.status).toBe(409);
    expect(
      (await send('POST', '/api/internal/items/A/copy-to/A', {}, { copy: async () => 'not_found' }))
        .status,
    ).toBe(400);
  });

  it('is a 404 for a door the app does not handle', async () => {
    expect((await send('POST', '/api/internal/items/A/revoke', { codes: [] }, {})).status).toBe(
      404,
    );
  });
});

describe('the person door', () => {
  it('drops what the app keeps for a closed account and anonymises their items', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const personClosed = vi.fn(async () => {});
    const anonymise = vi.fn(async () => {});
    const res = await send(
      'POST',
      '/api/internal/people/user_a/purge',
      { items: ['A', 'B'] },
      { personClosed, anonymise },
    );
    expect(await res.json()).toEqual({ ok: true, anonymised: 2, unreached: [] });
    expect(personClosed).toHaveBeenCalledWith('user_a');
    expect(anonymise).toHaveBeenCalledWith('B', 'user_a');
  });

  it('answers 503 while an item was not reached, and refuses a bad person or list', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const anonymise = async (id: string) => {
      if (id === 'B') throw new Error('down');
    };
    expect(
      (
        await send(
          'POST',
          '/api/internal/people/user_a/purge',
          { items: ['A', 'B'] },
          { anonymise },
        )
      ).status,
    ).toBe(503);
    expect((await send('POST', '/api/internal/people/robert/purge', {}, {})).status).toBe(404);
    expect(
      (await send('POST', '/api/internal/people/user_a/purge', { items: 'A' }, {})).status,
    ).toBe(400);
  });
});

describe('the guest-merge door', () => {
  it("moves what the app keeps for the guest to the account, and confirms when there's nothing to move", async () => {
    const personMerged = vi.fn(async () => {});
    const res = await send(
      'POST',
      '/api/internal/people/guest_g1/merge',
      { into: 'user_u1' },
      { personMerged },
    );
    expect(res.status).toBe(200);
    expect(personMerged).toHaveBeenCalledWith('guest_g1', 'user_u1');
    expect(
      (await send('POST', '/api/internal/people/guest_g1/merge', { into: 'user_u1' }, {})).status,
    ).toBe(200);
  });

  it('answers 503 when the move fails, and refuses anything but a guest into an account', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const personMerged = async () => {
      throw new Error('down');
    };
    expect(
      (
        await send(
          'POST',
          '/api/internal/people/guest_g1/merge',
          { into: 'user_u1' },
          { personMerged },
        )
      ).status,
    ).toBe(503);
    expect(
      (await send('POST', '/api/internal/people/user_a/merge', { into: 'user_u1' }, {})).status,
    ).toBe(404);
    for (const into of ['guest_g2', '', 7, undefined]) {
      expect((await send('POST', '/api/internal/people/guest_g1/merge', { into }, {})).status).toBe(
        400,
      );
    }
  });
});
