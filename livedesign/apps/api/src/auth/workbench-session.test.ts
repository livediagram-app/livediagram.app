import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountsUnavailable } from '../db/api-tokens';
import { noteWorkbenchRoom, resolveWorkbenchSession, sessionPrefixOf } from './workbench-session';

// Sessions are liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): the api asks accounts about each with its client
// credentials and reads the answer in its own words.
const ENV = {
  ACCOUNTS_URL: 'https://accounts.test',
  ACCOUNTS_CLIENT_ID: 'livedesign',
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
  it('reads a design session in the api’s own words', async () => {
    const calls = stubAccounts(() => Response.json(CHECKED));
    const s = secret();
    expect(await resolveWorkbenchSession(ENV, s)).toEqual({
      ok: true,
      workbench: {
        sessionId: 'sess-1234567',
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId: 'pair1',
        scope: 'design',
        designId: 'doc1',
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

  it('reads a workspace session with its folder and no design', async () => {
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
      workbench: { scope: 'workspace', designId: null, folderId: 'fold1' },
    });
  });

  it('is unknown for a session confined to one item that names none', async () => {
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
    await expect(resolveWorkbenchSession(ENV, secret())).rejects.toBeInstanceOf(
      AccountsUnavailable,
    );
  });

  it('logs a session by its id’s first eight characters', () => {
    expect(sessionPrefixOf('abcdefghijkl')).toBe('abcdefgh');
  });
});

describe('noteWorkbenchRoom', () => {
  it('tells accounts once per session and design', async () => {
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

  it('asks nothing with no accounts configured, and only logs a note that fails', async () => {
    const calls = stubAccounts(() => new Response(null, { status: 204 }));
    await noteWorkbenchRoom({}, { ownerId: 'user_1', sessionId: `s-${secret()}` }, 'doc1');
    expect(calls).toEqual([]);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      noteWorkbenchRoom(ENV, { ownerId: 'user_1', sessionId: `s-${secret()}` }, 'doc1'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[workbench] room note failed', expect.anything());
    warn.mockRestore();
  });
});
