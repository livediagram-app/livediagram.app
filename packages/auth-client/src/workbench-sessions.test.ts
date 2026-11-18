import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountCredentials } from './api-tokens';
import { createTokenRooms, createWorkbenchSessions, sessionPrefixOf } from './workbench-sessions';

// Sessions are liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): an api asks accounts about each
// with its client credentials and reads the answer in its own words, here a `doc` and its `docId`.
class Unavailable extends Error {}
const { resolveWorkbenchSession, noteWorkbenchRoom } = createWorkbenchSessions({
  credentials: accountCredentials,
  reach: (s) =>
    s.scope === 'item'
      ? { scope: 'doc' as const, docId: s.itemId!, folderId: null }
      : { scope: 'workspace' as const, docId: null, folderId: s.folderId },
  unavailable: () => new Unavailable(),
});
const ENV = {
  ACCOUNTS_URL: 'https://accounts.test',
  ACCOUNTS_CLIENT_ID: 'app',
  ACCOUNTS_CLIENT_SECRET: 'secret',
};

const CHECKED = {
  sessionId: 'sess-1234567',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  scope: 'item',
  itemId: 'doc1',
  folderId: null,
  tabId: 't1',
  origin: 'https://w.example',
  level: 'edit',
  expiresAt: 1_900_000_000_000,
  teams: [{ id: 'team1', name: 'T', role: 'member' }],
};

let secretN = 0;
// A fresh secret per test: the checker remembers answers for the life of the isolate.
const secret = () => `lvw_${String(++secretN).padStart(43, 'a')}.${'f'.repeat(64)}`;

function stubAccounts(respond: (path: string, body: Record<string, unknown>) => Response) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
      string,
      unknown
    >;
    calls.push({ path: url.pathname, body });
    return respond(url.pathname, body);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('resolveWorkbenchSession', () => {
  it('reads an item session in the api’s own words', async () => {
    const calls = stubAccounts(() => Response.json(CHECKED));
    const s = secret();
    expect(await resolveWorkbenchSession(ENV, s)).toEqual({
      ok: true,
      workbench: {
        sessionId: 'sess-1234567',
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId: 'pair1',
        scope: 'doc',
        docId: 'doc1',
        folderId: null,
        tabId: 't1',
        origin: 'https://w.example',
        level: 'edit',
        expiresAt: CHECKED.expiresAt,
        teams: CHECKED.teams,
      },
    });
    expect(calls).toEqual([
      { path: '/api/account/internal/workbench/session', body: { session: s } },
    ]);
    // Asked once a minute at most, however many requests the frame makes.
    await resolveWorkbenchSession(ENV, s);
    expect(calls).toHaveLength(1);
  });

  it('reads a workspace session with its folder and no item', async () => {
    stubAccounts(() =>
      Response.json({
        ...CHECKED,
        scope: 'workspace',
        itemId: null,
        folderId: 'fold1',
        tabId: null,
      }),
    );
    expect(await resolveWorkbenchSession(ENV, secret())).toMatchObject({
      ok: true,
      workbench: { scope: 'workspace', docId: null, folderId: 'fold1' },
    });
  });

  it('calls an item session with no item unknown', async () => {
    stubAccounts(() => Response.json({ ...CHECKED, itemId: null }));
    expect(await resolveWorkbenchSession(ENV, secret())).toEqual({ ok: false, reason: 'unknown' });
  });

  it('passes on why accounts refused it', async () => {
    stubAccounts(() =>
      Response.json({ error: 'invalid_session', reason: 'revoked' }, { status: 404 }),
    );
    expect(await resolveWorkbenchSession(ENV, secret())).toEqual({ ok: false, reason: 'revoked' });
  });

  it('is unknown with no accounts configured, and unavailable when accounts fails', async () => {
    expect(await resolveWorkbenchSession({}, secret())).toEqual({ ok: false, reason: 'unknown' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubAccounts(() => new Response(null, { status: 503 }));
    await expect(resolveWorkbenchSession(ENV, secret())).rejects.toBeInstanceOf(Unavailable);
  });

  it('logs a session by its id’s first eight characters', () => {
    expect(sessionPrefixOf('abcdefghijkl')).toBe('abcdefgh');
  });
});

describe('noteWorkbenchRoom', () => {
  it('tells accounts once per session and item', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    const session = { ownerId: 'user_1', sessionId: `s-${secret()}` };
    await noteWorkbenchRoom(ENV, session, 'doc1');
    await noteWorkbenchRoom(ENV, session, 'doc1');
    expect(calls).toEqual([
      {
        path: '/api/account/internal/workbench/rooms',
        body: { ownerId: 'user_1', sessionId: session.sessionId, itemId: 'doc1' },
      },
    ]);
  });

  it('asks nothing with no accounts configured', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    await noteWorkbenchRoom({}, { ownerId: 'user_1', sessionId: `s-${secret()}` }, 'doc1');
    expect(calls).toEqual([]);
  });

  it('is best effort: an unreachable accounts is logged, never thrown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network down');
    });
    await expect(
      noteWorkbenchRoom(ENV, { ownerId: 'user_1', sessionId: `s-${secret()}` }, 'doc1'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[workbench] room note failed', {
      error: 'TypeError: network down',
    });
  });
});

// public-api-and-tokens.md "Revoking a token": a token's room ticket notes the room at accounts until it lapses, from
// a workbench api and from one with no sessions at all (livehuddle's) alike.
describe('noteTokenRoom', () => {
  const { noteTokenRoom } = createTokenRooms({ credentials: accountCredentials });
  const input = (tokenId: string) => ({ ownerId: 'user_1', tokenId, itemId: 'doc1', until: 2e12 });

  it('tells accounts once per token, item and lapse', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    const tokenId = `tok-${secret()}`;
    await noteTokenRoom(ENV, input(tokenId));
    await noteTokenRoom(ENV, input(tokenId));
    expect(calls).toEqual([
      { path: '/api/account/internal/workbench/token-rooms', body: input(tokenId) },
    ]);
  });

  it('is the same note through a workbench api', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    const { noteTokenRoom: viaSessions } = createWorkbenchSessions({
      credentials: accountCredentials,
      reach: () => ({}),
      unavailable: () => new Unavailable(),
    });
    await viaSessions(ENV, input(`tok-${secret()}`));
    expect(calls.map((c) => c.path)).toEqual(['/api/account/internal/workbench/token-rooms']);
  });

  it('asks nothing with no accounts configured', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    await noteTokenRoom({}, input(`tok-${secret()}`));
    expect(calls).toEqual([]);
  });

  it('is best effort: an unreachable accounts is logged, never thrown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network down');
    });
    await expect(noteTokenRoom(ENV, input(`tok-${secret()}`))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[workbench] token room note failed', {
      error: 'TypeError: network down',
    });
  });
});
