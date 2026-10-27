import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// Deleting an account removes the livediagram data, then closes the liveworkspace account
// (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account").

const { db, authClient, order } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    db: {
      deleteAccount: vi.fn(async () => {
        order.push('data');
        return { documents: 2, folders: 1 };
      }),
    },
    authClient: {
      closeAccount: vi.fn(async () => {
        order.push('account');
      }),
    },
  };
});
vi.mock('../db', () => db);
vi.mock('@liveworkspace/auth-client', async (original) => ({
  ...(await original<typeof import('@liveworkspace/auth-client')>()),
  ...authClient,
}));

import { handleAccount } from './account';

const SIGN_IN: Partial<Env> = {
  ACCOUNTS_URL: 'https://liveworkspace.app',
  ACCOUNTS_CLIENT_ID: 'client-1',
  ACCOUNTS_CLIENT_SECRET: 's3cret',
  API_RESOURCE: 'https://livediagram.app/api',
};

function remove(opts: { env?: Partial<Env>; accountUserId?: string | null } = {}) {
  return handleAccount(
    makeTestRouteContext('DELETE', '/api/account', {
      accountUserId: opts.accountUserId === undefined ? 'user_1' : opts.accountUserId,
      headers: { Authorization: 'Bearer access-token' },
      env: { ...SIGN_IN, ...opts.env } as Env,
    }),
  );
}

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

describe('DELETE /api/account', () => {
  it('deletes the data, then closes the liveworkspace account with the caller’s token', async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: { documents: 2, folders: 1 } });
    expect(order).toEqual(['data', 'account']);
    expect(db.deleteAccount).toHaveBeenCalledWith(expect.anything(), 'user_1');
    expect(authClient.closeAccount).toHaveBeenCalledWith(
      {
        accountsUrl: SIGN_IN.ACCOUNTS_URL,
        clientId: 'client-1',
        clientSecret: 's3cret',
        resource: SIGN_IN.API_RESOURCE,
      },
      'access-token',
    );
  });

  it('clears the refresh cookie, since the refresh token went with the account', async () => {
    const cookies = (await remove()).headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('ld_refresh=;') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('says so when the account could not be closed, with the data already gone', async () => {
    authClient.closeAccount.mockRejectedValueOnce(new Error('closing the account failed (500)'));
    const res = await remove();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'account_not_closed',
      deleted: { documents: 2, folders: 1 },
    });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('deletes only the data on a deployment without sign-in', async () => {
    const res = await remove({ env: { ACCOUNTS_URL: undefined } });
    expect(res.status).toBe(200);
    expect(authClient.closeAccount).not.toHaveBeenCalled();
  });

  it('refuses a guest', async () => {
    const res = await remove({ accountUserId: null });
    expect(res.status).toBe(400);
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(authClient.closeAccount).not.toHaveBeenCalled();
  });
});
