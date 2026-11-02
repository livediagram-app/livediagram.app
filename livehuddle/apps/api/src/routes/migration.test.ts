// The browser's one-time doors of the move (routes/migration.ts): the legacy guest claim's forwarding and answers,
// and a This Browser document's parts handed to the index, with the real splitter and with a stub one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HandoffRequest,
  LocalSplitResult,
  MigrationRoomPayload,
} from '@liveworkspace/migration';
import type { Env } from '../types';
import { localPartId } from '../migration/local-parts';
import { handleLegacyGuestClaim } from './legacy-guest';
import { handleLocalParts } from './migration';
import { makeTestRouteContext } from './test-route-context';

const CALLER = 'guest_caller';
const LEGACY = '0b5f0d8e-7f7c-4c35-9a0e-2f3c1d4e5a6b';

type Call = { url: string; auth: string | null; person: string | null; body: unknown };

function envOf(extra: Partial<Env> = {}): Env {
  return {
    ACCOUNTS_URL: 'https://accounts.test',
    ACCOUNTS_CLIENT_ID: 'livehuddle',
    ACCOUNTS_CLIENT_SECRET: 'secret',
    INDEX_ORIGIN: 'https://index.test',
    INDEX_KEY: 'idx',
    ...extra,
  } as unknown as Env;
}

function stubFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const call = {
      url: req.url,
      auth: req.headers.get('Authorization'),
      person: req.headers.get('X-Index-Person'),
      body: await req.json().catch(() => null),
    };
    calls.push(call);
    return answer(call);
  });
  return calls;
}

const ctxOf = (
  path: string,
  body: unknown,
  opts: Parameters<typeof makeTestRouteContext>[2] = {},
) => makeTestRouteContext('POST', path, { owner: CALLER, env: envOf(), body, ...opts });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('POST /api/legacy-guest/claim', () => {
  const claim = (body: unknown, opts: Parameters<typeof makeTestRouteContext>[2] = {}) =>
    handleLegacyGuestClaim(ctxOf('/api/legacy-guest/claim', body, opts));

  it('forwards the claim with the api’s client credentials, into the caller', async () => {
    const calls = stubFetch(() => Response.json({ merged: true }));
    const res = await claim({ legacyId: LEGACY, signature: 'a'.repeat(43) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ merged: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://accounts.test/api/account/internal/legacy-guests/claim');
    expect(calls[0]!.auth).toMatch(/^Basic /);
    expect(calls[0]!.body).toEqual({ legacyId: LEGACY, signature: 'a'.repeat(43), into: CALLER });
  });

  it('answers 200 merged: false for a refusal that never clears, so the editor forgets the old keys', async () => {
    for (const [status, reason] of [
      [403, 'unknown'],
      [404, 'unknown'],
      [410, 'unknown'],
      [409, 'claimed'],
    ] as const) {
      stubFetch(() => Response.json({ error: 'x' }, { status }));
      const res = await claim({ legacyId: LEGACY, signature: null });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ merged: false, reason });
    }
    // Malformed ids and signatures are never sent on.
    const calls = stubFetch(() => Response.json({ merged: true }));
    for (const body of [
      { legacyId: 'not-a-uuid', signature: null },
      { legacyId: LEGACY.toUpperCase(), signature: null },
      { legacyId: LEGACY, signature: 'short' },
      { legacyId: LEGACY, signature: 7 },
    ]) {
      const res = await claim(body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ merged: false, reason: 'unknown' });
    }
    expect(calls).toHaveLength(0);
  });

  it('answers 503 for a refusal that may clear: accounts down or unreachable', async () => {
    stubFetch(() => new Response('down', { status: 500 }));
    expect((await claim({ legacyId: LEGACY, signature: null })).status).toBe(503);
    stubFetch(() => {
      throw new Error('unreachable');
    });
    expect((await claim({ legacyId: LEGACY, signature: null })).status).toBe(503);
  });

  it('takes only a browser’s guest or account, and limits per network and per caller', async () => {
    stubFetch(() => Response.json({ merged: true }));
    expect((await claim({ legacyId: LEGACY, signature: null }, { owner: null })).status).toBe(401);
    expect(
      (await claim({ legacyId: LEGACY, signature: null }, { token: { id: 't', readOnly: false } }))
        .status,
    ).toBe(401);
    const keys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: !key.startsWith('legacy-claim:') };
      },
    };
    const res = await claim(
      { legacyId: LEGACY, signature: null },
      { env: envOf({ SHARE_RATE_LIMITER: limiter }) },
    );
    expect(res.status).toBe(429);
    expect(keys[0]).toMatch(/^legacy-claim-ip:/);
    expect(keys[1]).toBe(`legacy-claim:${CALLER}`);
  });
});

describe('POST /api/migration/local-parts', () => {
  const shape = (id: string) => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  const diagram = { id: 'd1', name: 'Diagram', elements: [shape('a')] };
  const deck = {
    id: 's1',
    name: 'Deck',
    opensIn: 'pages',
    pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide' }],
    elements: [shape('b')],
  };
  const send = (body: unknown, deps?: Parameters<typeof handleLocalParts>[1], opts = {}) =>
    handleLocalParts(ctxOf('/api/migration/local-parts', body, opts), deps);

  it('splits with the real splitter, hands the other part to the index as the caller, and keeps the rest raw', async () => {
    const calls = stubFetch(() => Response.json({ ok: true }, { status: 201 }));
    const res = await send({ id: 'local-1', name: 'Mine', tabs: [diagram, deck] });
    expect(res.status).toBe(200);
    const answer = (await res.json()) as {
      parts: { app: string; id: string; url: string; tabIds: string[] }[];
      keep: unknown[];
    };
    const id = localPartId(CALLER, 'local-1:livedocuments');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(answer.parts).toEqual([
      {
        app: 'livedocuments',
        id,
        url: `https://www.livedocuments.app/document/${id}`,
        tabIds: ['s1'],
      },
    ]);
    expect(answer.keep).toEqual([diagram]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://index.test/api/index/app/migration/handoff');
    expect(calls[0]!.auth).toBe('Bearer idx');
    expect(calls[0]!.person).toBe(CALLER);
    const handoff = calls[0]!.body as HandoffRequest;
    expect(handoff).toMatchObject({ app: 'livedocuments', title: 'Mine' });
    expect(handoff.payload).toMatchObject({
      v: 1,
      app: 'livedocuments',
      id,
      ownerId: CALLER,
      teamId: null,
      imageOwners: [],
      imageGrants: [],
    });
  });

  it('names the same parts on a retry, and counts the index’s 409 item_exists as landed', async () => {
    stubFetch(() => Response.json({ ok: true }));
    const first = await (await send({ id: 'local-1', name: 'Mine', tabs: [diagram, deck] })).json();
    stubFetch(() => Response.json({ error: 'item_exists' }, { status: 409 }));
    const again = await send({ id: 'local-1', name: 'Mine', tabs: [diagram, deck] });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    // Another caller's same local document makes other ids.
    expect(localPartId('guest_other', 'local-1:livedocuments')).not.toBe(
      localPartId(CALLER, 'local-1:livedocuments'),
    );
  });

  it('answers 502 with the parts that landed when one handoff fails', async () => {
    const part = (app: MigrationRoomPayload['app'], id: string): MigrationRoomPayload =>
      ({
        v: 1,
        app,
        id,
        name: 'n',
        ownerId: 'forged',
        teamId: 'team-forged',
        tabs: [{ id: `${app}-t` }],
        changesets: [{ id: 'c' }],
        imageOwners: [{ imageId: 'i', owner: 'someone' }],
        imageGrants: [{ imageId: 'i', createdAt: 1 }],
      }) as unknown as MigrationRoomPayload;
    const split = vi.fn((): LocalSplitResult => ({
      keep: [diagram],
      parts: [part('livedocuments', 'p-docs'), part('livedesign', 'p-design')],
      crossReferences: [],
      notes: [],
    }));
    const handedOff: MigrationRoomPayload[] = [];
    const handOff = vi.fn(async (_env: Env, _caller: string, p: MigrationRoomPayload) => {
      handedOff.push(p);
      return p.app === 'livedesign' ? ('failed' as const) : ('landed' as const);
    });
    const res = await send({ id: 'l', name: 'Mine', tabs: [] }, { split, handOff });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'handoff_failed',
      parts: [
        {
          app: 'livedocuments',
          id: 'p-docs',
          url: 'https://www.livedocuments.app/document/p-docs',
          tabIds: ['livedocuments-t'],
        },
      ],
    });
    // Whose a part is comes from the verified caller, never the split's input.
    for (const p of handedOff) {
      expect(p).toMatchObject({
        ownerId: CALLER,
        teamId: null,
        changesets: [],
        imageOwners: [],
        imageGrants: [],
      });
    }
  });

  it('passes the raw record’s fields to the splitter, and refuses a malformed request', async () => {
    const split = vi.fn((): LocalSplitResult => ({
      keep: [],
      parts: [],
      crossReferences: [],
      notes: [],
    }));
    const handOff = vi.fn(async () => 'landed' as const);
    const record = {
      id: 'l',
      name: 'Mine',
      tabs: [],
      ownerId: 'old-guest',
      createdAt: 1,
      savedAt: 2,
      presentation: null,
      items: [],
      itemsRev: 3,
      itemsNextKey: 4,
      itemTypes: { task: {} },
      sheets: [],
    };
    expect((await send(record, { split, handOff })).status).toBe(200);
    expect(split).toHaveBeenCalledWith(record, expect.anything());
    for (const bad of [
      { name: 'x', tabs: [] },
      { id: 'l', tabs: [] },
      { id: 'l', name: 'x', tabs: {} },
      { id: 'l', name: 'x', tabs: [], savedAt: 'soon' },
      { id: 'l', name: 'x', tabs: Array.from({ length: 501 }, () => ({})) },
    ]) {
      expect((await send(bad, { split, handOff })).status).toBe(400);
    }
    expect((await send(record, { split, handOff }, { owner: null })).status).toBe(401);
    expect(
      (await send(record, { split, handOff }, { env: envOf({ INDEX_KEY: undefined }) })).status,
    ).toBe(503);
  });
});
