import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  AccountsUnavailable,
  mintApiToken,
  resolveApiToken,
  revokePresentedToken,
} from './api-tokens';

// API tokens are the liveworkspace account's (liveworkspace/docs/accounts.md "API tokens"): these
// stand liveworkspace up at `fetch` and check what this app does with its answers. It keeps no copy.

const ACCOUNTS = {
  ACCOUNTS_URL: 'https://accounts.example',
  ACCOUNTS_CLIENT_ID: 'livedocuments',
  ACCOUNTS_CLIENT_SECRET: 'secret',
} satisfies Partial<Env>;

type Handler = (path: string, body: Record<string, unknown>) => Response;
let handle: Handler;
const calls: string[] = [];
// The token checker keeps its fetch for the life of the module, so the stub stays and the handler
// changes. Each test uses its own tokens, since the checker remembers answers for a minute.
vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
  const path = new URL(input).pathname.replace('/api/account/internal', '');
  calls.push(path);
  return handle(
    path,
    typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {},
  );
});

const account = (tokenId: string, over: Record<string, unknown> = {}) => ({
  tokenId,
  userId: 'user_ada',
  name: 'Script',
  email: 'ada@example.com',
  readOnly: false,
  expiresAt: Date.now() + 86_400_000,
  teams: [{ id: 'team1', name: 'Design', role: 'admin' }],
  ...over,
});

let db: SqliteD1;
beforeEach(() => {
  db = sqliteD1(ACCOUNTS);
  calls.length = 0;
  handle = () => new Response(null, { status: 404 });
});

describe('resolveApiToken', () => {
  it('answers the account liveworkspace vouches for, writing nothing', async () => {
    handle = () => Response.json(account('tok-a', { readOnly: true, expiresAt: 77 }));
    const token = `lwt_${'a'.repeat(43)}`;
    expect(await resolveApiToken(db.env, token)).toEqual({
      ownerId: 'user_ada',
      tokenId: 'tok-a',
      readOnly: true,
      name: 'Script',
      expiresAt: 77,
      teams: [{ id: 'team1', name: 'Design', role: 'admin' }],
    });
    expect(
      db.sql.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%token%'").all(),
    ).toEqual([]);
  });

  it('asks liveworkspace once for a burst of requests', async () => {
    handle = () => Response.json(account('tok-b'));
    const token = `lwt_${'b'.repeat(43)}`;
    for (let i = 0; i < 5; i++) await resolveApiToken(db.env, token);
    expect(calls.filter((c) => c === '/tokens/verify')).toHaveLength(1);
  });

  it('refuses a token liveworkspace refuses', async () => {
    handle = () => Response.json(account('tok-c'));
    const token = `lwt_${'c'.repeat(43)}`;
    await resolveApiToken(db.env, token);
    handle = () => new Response(null, { status: 404 });
    // A fresh isolate's view: the same secret, refused.
    const { resolveApiToken: fresh } = await reimport();
    expect(await fresh(db.env, token)).toBeNull();
  });

  it('throws AccountsUnavailable when liveworkspace cannot answer, so the caller can 503', async () => {
    handle = () => new Response(null, { status: 502 });
    await expect(resolveApiToken(db.env, `lwt_${'d'.repeat(43)}`)).rejects.toBeInstanceOf(
      AccountsUnavailable,
    );
  });

  it('is null on a deployment without sign-in', async () => {
    expect(await resolveApiToken(sqliteD1().env, `lwt_${'e'.repeat(43)}`)).toBeNull();
  });
});

describe('mintApiToken', () => {
  it('asks liveworkspace for a token for whoever the access token is', async () => {
    let asked: Record<string, unknown> = {};
    handle = (path, body) => {
      asked = { path, ...body };
      return Response.json(
        { id: 'tok-m', name: 'Claude', readOnly: false, expiresAt: 5, secret: 'lwt_x' },
        { status: 201 },
      );
    };
    expect(
      await mintApiToken(db.env, { accessToken: 'jwt', name: 'Claude', readOnly: false }),
    ).toEqual({ secret: 'lwt_x', id: 'tok-m', expiresAt: 5 });
    expect(asked).toEqual({ path: '/tokens', accessToken: 'jwt', name: 'Claude', readOnly: false });
  });

  it('is null at the account’s token cap', async () => {
    handle = () => new Response(null, { status: 409 });
    expect(
      await mintApiToken(db.env, { accessToken: 'jwt', name: 'x', readOnly: false }),
    ).toBeNull();
  });
});

describe('revokePresentedToken', () => {
  it('revokes a token at liveworkspace', async () => {
    handle = () => Response.json({ ok: true });
    await revokePresentedToken(db.env, `lwt_${'r'.repeat(43)}`);
    expect(calls).toContain('/tokens/revoke');
  });

  it('asks nothing on a deployment without sign-in', async () => {
    await revokePresentedToken(sqliteD1().env, `lwt_${'s'.repeat(43)}`);
    expect(calls).toEqual([]);
  });
});

// A second copy of the module, with nothing remembered: what another isolate would see.
async function reimport() {
  vi.resetModules();
  return import('./api-tokens');
}
