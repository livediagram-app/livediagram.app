import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountsUnavailable } from '../db/api-tokens';
import { resolveWorkbenchSession } from './workbench-session';

// Sessions are liveworkspace's (liveworkspace/docs/specs/011-workbench/workbench.md): the api asks accounts about each with its client
// credentials and reads the answer in its own words. The checking, caching, refusals and room notes are
// @liveworkspace/auth-client's, tested in workbench-sessions.test.ts; this holds the api's names for what a session reaches.
const ENV = {
  ACCOUNTS_URL: 'https://accounts.test',
  ACCOUNTS_CLIENT_ID: 'livediagram',
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
  it('reads a document session in the api’s own words', async () => {
    const calls = stubAccounts(() => Response.json(CHECKED));
    const s = secret();
    expect(await resolveWorkbenchSession(ENV, s)).toEqual({
      ok: true,
      workbench: {
        sessionId: 'sess-1234567',
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId: 'pair1',
        scope: 'document',
        documentId: 'doc1',
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

  it('reads a workspace session with its folder and no document', async () => {
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
      workbench: { scope: 'workspace', documentId: null, folderId: 'fold1' },
    });
  });

  it('is unavailable, in this api’s error, when accounts fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubAccounts(() => new Response(null, { status: 503 }));
    await expect(resolveWorkbenchSession(ENV, secret())).rejects.toBeInstanceOf(
      AccountsUnavailable,
    );
  });
});
