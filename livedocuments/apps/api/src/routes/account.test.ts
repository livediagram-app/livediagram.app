import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// Deleting an account removes the livedocuments data, then closes the liveworkspace account
// (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account").

const { db, authClient, order } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    db: {
      deleteAccount: vi.fn(async () => {
        order.push('data');
        return { folders: 1 };
      }),
    },
    // The app's side of @liveworkspace/auth-client's deletion code (tested there): the code '123456' checks out and
    // hands back the close; any other is refused.
    authClient: {
      closeAccount: vi.fn(async () => {
        order.push('account');
      }),
      confirmDeletionCode: vi.fn(async (credentials: unknown, _token: unknown, code: unknown) => {
        if (!credentials) {
          return { ok: false, answer: { status: 503, body: { error: 'accounts_unavailable' } } };
        }
        return code === '123456'
          ? { ok: true, closeAccount: () => authClientCloseAccount() }
          : { ok: false, answer: { status: 403, body: { error: 'invalid_code' } } };
      }),
      requestDeletionCode: vi.fn(async () => ({ status: 200, body: { sent: true } })),
    },
  };
});
vi.mock('../db', () => db);

// The index as the purge reaches it: the person's own documents (live and trashed), and what it deleted.
const { index } = vi.hoisted(() => ({
  index: {
    items: [] as { id: string; ownerId: string }[],
    trash: [] as { id: string; ownerId: string }[],
    deleted: [] as string[],
  },
}));
// A listing paged by a keyset cursor (the last id's place in the list as first read), as the index's: deleting an
// item never shifts the next page.
const { pageOf, listOrder } = vi.hoisted(() => ({
  listOrder: new Map<string, number>(),
  pageOf: (
    items: { id: string; ownerId: string }[],
    q: { cursor?: string; limit?: number },
    order: Map<string, number>,
  ) => {
    for (const i of items) if (!order.has(i.id)) order.set(i.id, order.size);
    const after = q.cursor === undefined ? -1 : Number(q.cursor);
    const rest = items.filter((i) => order.get(i.id)! > after);
    const page = rest.slice(0, q.limit ?? 200);
    const more = rest.length > page.length;
    return { items: page, nextCursor: more ? String(order.get(page.at(-1)!.id)) : null };
  },
}));
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  indexFor: () => ({
    listItems: async (q: { cursor?: string; limit?: number }) => pageOf(index.items, q, listOrder),
    listTrash: async (q: { cursor?: string; limit?: number }) => pageOf(index.trash, q, listOrder),
    deleteItem: async (id: string) => {
      index.deleted.push(id);
      index.items = index.items.filter((i) => i.id !== id);
      index.trash = index.trash.filter((i) => i.id !== id);
    },
  }),
}));
vi.mock('@liveworkspace/auth-client', async (original) => ({
  ...(await original<typeof import('@liveworkspace/auth-client')>()),
  confirmDeletionCode: authClient.confirmDeletionCode,
  requestDeletionCode: authClient.requestDeletionCode,
}));
function authClientCloseAccount() {
  return authClient.closeAccount();
}

import { handleAccount } from './account';

const SIGN_IN: Partial<Env> = {
  ACCOUNTS_URL: 'https://liveworkspace.app',
  ACCOUNTS_CLIENT_ID: 'client-1',
  ACCOUNTS_CLIENT_SECRET: 's3cret',
  API_RESOURCE: 'https://livedocuments.app/api',
};

function remove(
  opts: { env?: Partial<Env>; accountUserId?: string | null; code?: string | null } = {},
) {
  return handleAccount(
    makeTestRouteContext('DELETE', '/api/account', {
      accountUserId: opts.accountUserId === undefined ? 'user_1' : opts.accountUserId,
      headers: { Authorization: 'Bearer access-token' },
      env: { ...SIGN_IN, ...opts.env } as Env,
      ...(opts.code !== null && { body: { code: opts.code ?? '123456' } }),
    }),
  );
}

function askForCode(opts: { accountUserId?: string | null; path?: string } = {}) {
  return handleAccount(
    makeTestRouteContext('POST', opts.path ?? '/api/account/deletion-code', {
      accountUserId: opts.accountUserId === undefined ? 'user_1' : opts.accountUserId,
      headers: { Authorization: 'Bearer access-token' },
      env: SIGN_IN as Env,
    }),
  );
}

beforeEach(() => {
  order.length = 0;
  listOrder.clear();
  index.items = [
    { id: 'p1', ownerId: 'user_1' },
    { id: 'shared', ownerId: 'user_2' },
  ];
  index.trash = [{ id: 'p2', ownerId: 'user_1' }];
  index.deleted = [];
  vi.clearAllMocks();
});

describe('DELETE /api/account', () => {
  it('deletes the data, then closes the liveworkspace account with the caller’s token', async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: { documents: 2 } });
    // The person's own documents, live or trashed, go for good through the index; someone else's stay.
    expect(index.deleted.sort()).toEqual(['p1', 'p2']);
    expect(order).toEqual(['data', 'account']);
    expect(db.deleteAccount).toHaveBeenCalledWith(expect.anything(), 'user_1');
    // The code is checked with this app's credentials and the caller's token before anything goes.
    expect(authClient.confirmDeletionCode).toHaveBeenCalledWith(
      {
        accountsUrl: SIGN_IN.ACCOUNTS_URL,
        clientId: 'client-1',
        clientSecret: 's3cret',
        resource: SIGN_IN.API_RESOURCE,
      },
      'access-token',
      '123456',
    );
    expect(authClient.closeAccount).toHaveBeenCalledTimes(1);
  });

  it('clears the refresh cookie, since the refresh token went with the account', async () => {
    const cookies = (await remove()).headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('ldoc_refresh=;') && c.includes('Max-Age=0'))).toBe(
      true,
    );
  });

  it('reads past a page holding none of the person’s own documents', async () => {
    index.items = [
      ...Array.from({ length: 200 }, (_, i) => ({ id: `other-${i}`, ownerId: 'user_2' })),
      { id: 'p1', ownerId: 'user_1' },
    ];
    index.trash = [];
    const res = await remove();
    expect(res.status).toBe(200);
    expect(index.deleted).toEqual(['p1']);
  });

  it('finishes under the cap, and asks again past it', async () => {
    const own = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `d${i}`, ownerId: 'user_1' }));
    index.items = own(800);
    index.trash = [];
    const exact = await remove();
    expect(exact.status).toBe(200);
    expect(await exact.json()).toEqual({ deleted: { documents: 800 } });
    index.items = own(1001);
    index.deleted = [];
    const over = await remove();
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({
      error: 'documents_remaining',
      deleted: { documents: 1000, more: true },
    });
  });

  it('finishes at exactly 1,000 live documents, reading the Trash past the last page', async () => {
    const own = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, ownerId: 'user_1' }));
    index.items = own(1000, 'e');
    index.trash = [];
    const exact = await remove();
    expect(exact.status).toBe(200);
    expect(await exact.json()).toEqual({ deleted: { documents: 1000 } });
    index.items = own(1000, 'f');
    index.trash = own(1, 't');
    index.deleted = [];
    const trashLeft = await remove();
    expect(trashLeft.status).toBe(409);
    expect(index.trash).toHaveLength(1);
  });

  it('says so when the account could not be closed, with the data already gone', async () => {
    authClient.closeAccount.mockRejectedValueOnce(new Error('closing the account failed (500)'));
    const res = await remove();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'account_not_closed',
      deleted: { documents: 2 },
    });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('deletes nothing on a deployment without sign-in, where no code can be checked', async () => {
    const res = await remove({ env: { ACCOUNTS_URL: undefined } });
    expect(res.status).toBe(503);
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(index.deleted).toEqual([]);
    expect(authClient.closeAccount).not.toHaveBeenCalled();
  });

  it('deletes nothing without the right code', async () => {
    for (const code of ['000000', null]) {
      const res = await remove({ code });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'invalid_code' });
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(authClient.confirmDeletionCode).toHaveBeenLastCalledWith(
      expect.anything(),
      'access-token',
      undefined,
    );
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(index.deleted).toEqual([]);
    expect(authClient.closeAccount).not.toHaveBeenCalled();
  });

  it('refuses a guest', async () => {
    const res = await remove({ accountUserId: null });
    expect(res.status).toBe(400);
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(index.deleted).toEqual([]);
    expect(authClient.closeAccount).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/deletion-code', () => {
  it('asks the accounts Worker to email the code, with this app’s credentials and the caller’s token', async () => {
    const res = await askForCode();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(authClient.requestDeletionCode).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' }),
      'access-token',
    );
  });

  it('refuses a guest, and answers nothing else under /api/account', async () => {
    expect((await askForCode({ accountUserId: null })).status).toBe(400);
    expect((await askForCode({ path: '/api/account/other' })).status).toBe(404);
    expect(authClient.requestDeletionCode).not.toHaveBeenCalled();
  });
});
