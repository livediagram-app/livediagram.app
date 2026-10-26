import { describe, expect, it } from 'vitest';
import {
  createWorkbenchRoomNoter,
  createWorkbenchSessionChecker,
  takeAllowance,
  type WorkbenchSessionCheck,
} from './workbench';

const CREDENTIALS = {
  accountsUrl: 'https://liveworkspace.app/',
  clientId: 'liveplanner',
  clientSecret: 's3cret',
};

const SECRET = `lvw_${'a'.repeat(43)}.${'f'.repeat(64)}`;

const SESSION: WorkbenchSessionCheck = {
  sessionId: 's1',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'p1',
  scope: 'item',
  itemId: 'plan1',
  folderId: null,
  tabId: null,
  origin: 'https://127.0.0.1:5175',
  level: 'edit',
  expiresAt: 10_000_000,
  teams: [{ id: 't1', name: 'Design', role: 'member' }],
};

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('createWorkbenchSessionChecker', () => {
  it('asks accounts once with the client credentials, then remembers for a minute', async () => {
    let at = 1_000;
    const { fetcher, calls } = fakeFetch(() => Response.json(SESSION));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher, now: () => at });
    await expect(check(SECRET)).resolves.toEqual({ ok: true, session: SESSION });
    at += 59_000;
    await check(SECRET);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/workbench/session');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${btoa('liveplanner:s3cret')}`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ session: SECRET });
    at += 2_000;
    await check(SECRET);
    expect(calls).toHaveLength(2);
  });

  it('never trusts a session past its own expiry', async () => {
    let at = 1_000;
    const { fetcher, calls } = fakeFetch(() => Response.json({ ...SESSION, expiresAt: 5_000 }));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher, now: () => at });
    await check(SECRET);
    at = 5_000;
    await check(SECRET);
    expect(calls).toHaveLength(2);
  });

  it('remembers a refusal, with its reason, for ten seconds', async () => {
    let at = 1_000;
    const { fetcher, calls } = fakeFetch(() =>
      Response.json({ error: 'invalid_session', reason: 'revoked' }, { status: 404 }),
    );
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher, now: () => at });
    await expect(check(SECRET)).resolves.toEqual({ ok: false, reason: 'revoked' });
    at += 9_000;
    await check(SECRET);
    expect(calls).toHaveLength(1);
    at += 2_000;
    await check(SECRET);
    expect(calls).toHaveLength(2);
  });

  it('reads a malformed answer as unknown', async () => {
    const { fetcher } = fakeFetch(() => Response.json({ ...SESSION, level: 'owner' }));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher });
    await expect(check(SECRET)).resolves.toEqual({ ok: false, reason: 'unknown' });
  });

  it('throws when accounts fails, rather than calling the session bad', async () => {
    const { fetcher } = fakeFetch(() => new Response(null, { status: 503 }));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher });
    await expect(check(SECRET)).rejects.toThrow('503');
  });

  it('keeps at most maxEntries, the oldest going first', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(SESSION));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher, maxEntries: 2 });
    await check(`${SECRET}1`);
    await check(`${SECRET}2`);
    await check(`${SECRET}3`);
    await check(`${SECRET}1`);
    expect(calls).toHaveLength(4);
  });

  // The hot path's guard: a frame's thousand requests in a minute cost accounts one, in well under a second.
  it('answers 1,000 checks of one session with one request', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json(SESSION));
    const check = createWorkbenchSessionChecker(CREDENTIALS, { fetcher, now: () => 1_000 });
    const started = performance.now();
    for (let i = 0; i < 1_000; i++) await check(SECRET);
    expect(calls).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('createWorkbenchRoomNoter', () => {
  it('tells accounts once per session and room', async () => {
    const { fetcher, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    const note = createWorkbenchRoomNoter(CREDENTIALS, { fetcher });
    const input = { ownerId: 'user_1', sessionId: 's1', itemId: 'plan1' };
    await expect(note(input)).resolves.toBe(true);
    await note(input);
    await note({ ...input, itemId: 'plan2' });
    expect(calls.map((c) => JSON.parse(c.init.body as string).itemId)).toEqual(['plan1', 'plan2']);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/workbench/rooms');
  });

  it('tries again after a note that failed', async () => {
    let status = 503;
    const { fetcher, calls } = fakeFetch(() => new Response(null, { status }));
    const note = createWorkbenchRoomNoter(CREDENTIALS, { fetcher });
    const input = { ownerId: 'user_1', sessionId: 's1', itemId: 'plan1' };
    await expect(note(input)).resolves.toBe(false);
    status = 204;
    await expect(note(input)).resolves.toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('takeAllowance', () => {
  it('answers how many uses accounts took', async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json({ taken: 2 }));
    const input = {
      personId: 'user_1',
      kind: 'notify-email',
      max: 60,
      windowMs: 3_600_000,
      count: 3,
    };
    await expect(takeAllowance(CREDENTIALS, input, fetcher)).resolves.toBe(2);
    expect(calls[0]!.url).toBe('https://liveworkspace.app/api/account/internal/allowance');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(input);
  });

  it('throws when accounts cannot answer, so nothing is sent', async () => {
    const { fetcher } = fakeFetch(() => new Response(null, { status: 500 }));
    await expect(
      takeAllowance(
        CREDENTIALS,
        { personId: 'user_1', kind: 'k', max: 1, windowMs: 1, count: 1 },
        fetcher,
      ),
    ).rejects.toThrow('500');
  });
});
