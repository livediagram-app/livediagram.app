// A photo read's AI credits (docs/specs/021-event-storming/note-reader.md "AI credits (Pro)"): with Pro off the route
// asks nothing and answers as before; with it on, one credit for every 24 notes is spent before the model is called, from the OWNER of
// the diagram the notes are read into (never the reader, and never what the request claims), a read is paid for
// once, and with none left the model is never called.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel, ReadNotesResponse } from '@livediagram/api-schema';
import type { TeamClaim } from '@liveworkspace/auth-client';
import type { Env } from '../types';
import type { ItemGrant } from '../index-service';
import { testPersonStores } from '../test-person-store';
import type { RouteContext } from './context';

let grant: ItemGrant | null | Response | Error = null;
const granted = vi.hoisted(() => ({ asked: [] as string[] }));
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(async (_ctx: unknown, documentId: string) => {
    granted.asked.push(documentId);
    if (grant instanceof Error) throw grant;
    return grant;
  }),
}));
const { handleAiReadNotes } = await import('./ai-read-notes');
const { OWNER_READS_BY_OTHERS_PER_DAY, READ_PASS_MS, readPassHolds, sealReadPass } =
  await import('./ai-credits');
const { giveBackOwnerReadIn, takeOwnerReadIn } = await import('../document-room/owner-reads');

const TINY_JPEG = 'data:image/jpeg;base64,AAAA';
const DOC = 'doc1';
const OWNER = 'user_owner';
const READ = 'read-0001';
const START = Date.UTC(2026, 10, 20, 12);

// The subscription service, standing in: each owner's AI credits, all-or-nothing, with every request kept in order
// beside the model's.
let order: string[] = [];
let used = new Map<string, number>();
let limit = 50;
let down = false;
// The status the service refuses everything with (a rotated key is 401); null when it answers.
let refusing: number | null = null;
let serial = 0;
const subscription = {
  fetch: async (input: string, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { owner: string; amount: number };
    order.push(`${input.split('/internal/')[1]}:${body.owner}`);
    if (down) return new Response('down', { status: 503 });
    if (refusing !== null) return Response.json({ error: 'unauthorised' }, { status: refusing });
    const spent = used.get(body.owner) ?? 0;
    if (spent + body.amount > limit) {
      return Response.json({ ok: false, used: spent, limit, tier: 'free' });
    }
    used.set(body.owner, spent + body.amount);
    return Response.json({ ok: true, used: spent + body.amount, limit, tier: 'free' });
  },
};

// Each diagram's room, as far as a read asks it: its day's count of reads charged to its owner by someone else.
let rooms = new Map<string, Map<string, unknown>>();
let roomDown = false;
const DOCUMENT_ROOM = {
  idFromName: (name: string) => name,
  get: (name: string) => ({
    takeOwnerRead: async (_documentId: string, day: string, cap: number) => {
      if (roomDown) throw new Error('room unavailable');
      const map = rooms.get(name) ?? new Map<string, unknown>();
      rooms.set(name, map);
      const storage = {
        get: async (k: string) => map.get(k),
        put: async (k: string, v: unknown) => void map.set(k, v),
      } as unknown as DurableObjectStorage;
      return takeOwnerReadIn(storage, day, cap);
    },
    giveBackOwnerRead: async (_documentId: string, day: string) => {
      if (roomDown) throw new Error('room unavailable');
      const map = rooms.get(name) ?? new Map<string, unknown>();
      rooms.set(name, map);
      const storage = {
        get: async (k: string) => map.get(k),
        put: async (k: string, v: unknown) => void map.set(k, v),
      } as unknown as DurableObjectStorage;
      return giveBackOwnerReadIn(storage, day);
    },
  }),
};

const originalFetch = globalThis.fetch;
beforeEach(() => {
  rooms = new Map();
  roomDown = false;
  vi.useFakeTimers({ toFake: ['Date'], now: START });
  order = [];
  used = new Map();
  limit = 50;
  down = false;
  refusing = null;
  grant = null;
  granted.asked = [];
  globalThis.fetch = vi.fn(async () => {
    order.push('model');
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify({ texts: [] }) } }] }),
      { status: 200 },
    );
  }) as typeof fetch;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function grantOn(sub: string, over: Partial<ItemGrant> = {}, level: AccessLevel = 'edit') {
  return {
    item: DOC,
    level,
    tab: null,
    sub,
    team: null,
    owner: OWNER,
    exp: 9_999_999_999,
    shareCode: null,
    token: 'signed',
    ...over,
  } satisfies ItemGrant;
}

type Reader = { account?: string | null; teams?: TeamClaim[] };

function read(
  body: Record<string, unknown> = {},
  reader: Reader = {},
  env: Partial<Env> = {},
): Promise<Response> {
  const account = reader.account === undefined ? 'user_reader' : reader.account;
  const request = new Request('https://api.example.com/api/ai/read-notes', {
    method: 'POST',
    body: JSON.stringify({ crops: [{ id: 1, image: TINY_JPEG }], notes: 10, ...body }),
  });
  const ctx: RouteContext = {
    request,
    env: {
      GOOGLE_AI_STUDIO_API_KEY: 'test-key',
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'app-key',
      // An address of its own per request set, so one test's outage is never another's.
      SUBSCRIPTION_URL: `https://subscription.test/${serial}`,
      SUBSCRIPTION: subscription,
      DOCUMENT_ROOM,
      ...env,
    } as Env,
    url: new URL(request.url),
    segments: ['api', 'ai', 'read-notes'],
    accountUserId: account,
    verifiedUserId: account,
    accountEmail: null,
    resolveOwner: () => account ?? 'guest_00000000-0000-4000-8000-000000000009',
    teams: reader.teams ?? null,
  };
  return handleAiReadNotes(ctx);
}
beforeEach(() => {
  serial++;
});

const credits = async (res: Response) => (await res.json<ReadNotesResponse>()).credits;

describe('with Pro off', () => {
  it('spends nothing, asks nobody and answers as before, whatever the request says', async () => {
    grant = grantOn('user_reader');
    for (const PRO_ENABLED of [undefined, 'false']) {
      const res = await read(
        { documentId: DOC, read: READ, pass: 'x.y', tier: 'pro' },
        {},
        { PRO_ENABLED },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ texts: [{ id: 1, text: '', legible: false }] });
    }
    expect(order).toEqual(['model', 'model']);
    expect(granted.asked).toEqual([]);
  });
});

describe('the credits, before the model is called', () => {
  it("spends the diagram's owner's credit first, then calls the model", async () => {
    grant = grantOn(OWNER);
    const res = await read({ documentId: DOC, read: READ }, { account: OWNER });
    expect(res.status).toBe(200);
    expect(order).toEqual(['spend:p:user_owner', 'model']);
    expect(await credits(res)).toEqual({
      owner: 'p:user_owner',
      pass: expect.stringMatching(/^\d+\.[\w-]+$/),
      cost: 1,
      used: 1,
      max: 50,
    });
  });

  it.each([
    [1, 1],
    [24, 1],
    [25, 2],
    [30, 2],
    [96, 4],
    [400, 17],
  ])('spends what %i notes cost (%i), all at once', async (notes, cost) => {
    grant = grantOn(OWNER);
    limit = 1000;
    const res = await read(
      { documentId: DOC, read: READ, notes, crops: [{ id: 0, image: TINY_JPEG }] },
      { account: OWNER },
    );
    expect(await credits(res)).toMatchObject({ cost, used: cost });
    expect(order).toEqual(['spend:p:user_owner', 'model']);
  });

  it('refuses a read that costs more than is left, whole: nothing is spent and the model is not called', async () => {
    grant = grantOn(OWNER);
    used.set('p:user_owner', 49);
    const res = await read({ documentId: DOC, read: READ, notes: 30 }, { account: OWNER });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'ai_credits_used', used: 49, max: 50 });
    expect(used.get('p:user_owner')).toBe(49);
    expect(order).not.toContain('model');
  });

  it('refuses a charged read that says no note count, or a count that is not one, and spends nothing', async () => {
    grant = grantOn(OWNER);
    for (const notes of [undefined, 0, -3, 2.5, 401, '10', null]) {
      const res = await read({ documentId: DOC, read: READ, notes }, { account: OWNER });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'notes_required' });
    }
    expect(order).toEqual([]);
    // An uncharged read (a guest, nobody to charge) is not asked for one.
    expect((await read({ notes: undefined }, { account: null })).status).toBe(200);
  });

  it('hands back the pass of a read that spent and then failed, so its next batch is not charged again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    grant = grantOn(OWNER);
    globalThis.fetch = vi.fn(async () => new Response('busy', { status: 503 })) as typeof fetch;
    const res = await read({ documentId: DOC, read: READ, notes: 30 }, { account: OWNER });
    expect(res.status).toBe(502);
    const body = await res.json<{ error: string; credits: { pass: string } }>();
    expect(body).toMatchObject({ error: 'ai_error', credits: { owner: 'p:user_owner', cost: 2 } });
    globalThis.fetch = vi.fn(async () => new Response('out', { status: 429 })) as typeof fetch;
    const again = await read(
      { documentId: DOC, read: READ, notes: 30, pass: body.credits.pass },
      { account: OWNER },
    );
    expect(await again.json()).toMatchObject({ error: 'ai_quota', credits: { cost: 2 } });
    expect(used.get('p:user_owner')).toBe(2);
    // With nobody charged, a failure says nothing of credits.
    const guest = await read({}, { account: null });
    expect(await guest.json()).toEqual({ error: 'ai_quota' });
  });

  it('refuses with none left, and never calls the model', async () => {
    grant = grantOn(OWNER);
    used.set('p:user_owner', 50);
    const res = await read({ documentId: DOC, read: READ }, { account: OWNER });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'ai_credits_used',
      limit: 'aiCreditsPerMonth',
      used: 50,
      max: 50,
      owner: 'p:user_owner',
    });
    expect(order).toEqual(['spend:p:user_owner']);
  });

  it('reads nothing uncounted when the service refuses this Worker, and never says the credits are used', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    grant = grantOn(OWNER);
    for (refusing of [401, 400, 404]) {
      const res = await read({ documentId: DOC, read: READ }, { account: OWNER });
      // The reader is unavailable (its own key is at fault): no model, no offer to upgrade.
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'ai_not_configured' });
    }
    expect(order).not.toContain('model');
  });

  it('never stops the reader because the subscription service is down, and claims no count then', async () => {
    grant = grantOn(OWNER);
    down = true;
    const res = await read({ documentId: DOC, read: READ }, { account: OWNER });
    expect(res.status).toBe(200);
    expect(order.at(-1)).toBe('model');
    const said = await credits(res);
    expect(said).toMatchObject({ owner: 'p:user_owner' });
    expect(said).not.toHaveProperty('used');
  });

  it('keeps the gate in front: a request it refuses spends no credit', async () => {
    grant = grantOn(OWNER);
    const env = { PERSON_STORE: testPersonStores(), AI_DAILY_CAP: '1' };
    expect((await read({ documentId: DOC, read: READ }, {}, env)).status).toBe(200);
    const res = await read({ documentId: DOC, read: 'read-0002' }, {}, env);
    expect(await res.json()).toEqual({ error: 'ai_quota' });
    expect(used.get('p:user_owner')).toBe(1);
    // Nor does a body that is no read at all.
    expect((await read({ crops: [] })).status).toBe(400);
    expect(used.get('p:user_owner')).toBe(1);
  });
});

describe('who pays', () => {
  it("is the owner for a signed-in collaborator's read, who is told no count; a guest's read is nobody's", async () => {
    grant = grantOn('user_collaborator');
    const collaborator = await read(
      { documentId: DOC, read: READ },
      { account: 'user_collaborator' },
    );
    expect(await credits(collaborator)).toEqual({
      owner: 'p:user_owner',
      pass: expect.any(String),
      cost: 1,
    });
    // An anonymous Editor link: the read is charged to nobody (the gate's day cap alone bounds it, as before Pro),
    // and the visitor is told nothing of the owner.
    grant = grantOn('link:CODE');
    const guest = await read({ documentId: DOC, read: 'read-0002' }, { account: null });
    expect(guest.status).toBe(200);
    expect(await credits(guest)).toBeUndefined();
    expect(order.filter((o) => o.startsWith('spend'))).toEqual(['spend:p:user_owner']);
    expect(used.has('p:user_collaborator')).toBe(false);
  });

  it('never lets an anonymous edit link spend the owner’s credits, however many requests it makes', async () => {
    grant = grantOn('link:CODE');
    for (let n = 0; n < 60; n += 1) {
      // With a read id, without one, with a made-up pass: none of it reaches the owner's month.
      const body =
        n % 3 === 0 ? { documentId: DOC } : { documentId: DOC, read: `read-${1000 + n}` };
      expect((await read({ ...body, pass: 'x.y' }, { account: null })).status).toBe(200);
    }
    expect(order.filter((o) => o.startsWith('spend'))).toEqual([]);
    expect(used.size).toBe(0);
  });

  it('takes only twenty reads a day a diagram from people who are not its owner, and never holds the owner back', async () => {
    grant = grantOn('user_collaborator');
    for (let n = 0; n < OWNER_READS_BY_OTHERS_PER_DAY; n += 1) {
      const res = await read(
        { documentId: DOC, read: `read-${1000 + n}` },
        { account: 'user_collaborator' },
      );
      expect(res.status).toBe(200);
    }
    // The twenty-first, by them or by another collaborator: read on the device, and nothing of the owner's spent.
    for (const account of ['user_collaborator', 'user_another']) {
      grant = grantOn(account);
      const over = await read({ documentId: DOC, read: 'read-9999' }, { account });
      expect(over.status).toBe(429);
      expect(await over.json()).toEqual({ error: 'ai_quota' });
    }
    expect(used.get('p:user_owner')).toBe(OWNER_READS_BY_OTHERS_PER_DAY);
    // A read already paid for still finishes on its pass.
    // The owner's own reads are never counted against it.
    grant = grantOn(OWNER);
    expect((await read({ documentId: DOC, read: 'read-own1' }, { account: OWNER })).status).toBe(
      200,
    );
    // Another diagram has its own day, and tomorrow starts again.
    grant = grantOn('user_collaborator', { item: 'doc2' });
    expect(
      (await read({ documentId: 'doc2', read: 'read-0002' }, { account: 'user_collaborator' }))
        .status,
    ).toBe(200);
    vi.setSystemTime(START + 24 * 60 * 60 * 1000);
    grant = grantOn('user_collaborator');
    expect(
      (await read({ documentId: DOC, read: 'read-0003' }, { account: 'user_collaborator' })).status,
    ).toBe(200);
  });

  it('gives the day’s slot back for a read the owner’s credits refused, so a used month never shortens the day', async () => {
    grant = grantOn('user_collaborator');
    used.set('p:user_owner', 50);
    for (let n = 0; n < 5; n += 1) {
      const res = await read(
        { documentId: DOC, read: `read-${2000 + n}` },
        { account: 'user_collaborator' },
      );
      expect(await res.json()).toMatchObject({ error: 'ai_credits_used' });
    }
    expect(rooms.get(DOC)?.get('ai-owner-reads')).toEqual({ day: '2026-11-20', count: 0 });
    // The month refilled (an upgrade): all twenty of the day's reads are still there.
    limit = 1000;
    for (let n = 0; n < OWNER_READS_BY_OTHERS_PER_DAY; n += 1) {
      const res = await read(
        { documentId: DOC, read: `read-${3000 + n}` },
        { account: 'user_collaborator' },
      );
      expect(res.status).toBe(200);
    }
    const over = await read(
      { documentId: DOC, read: 'read-9998' },
      { account: 'user_collaborator' },
    );
    expect(await over.json()).toEqual({ error: 'ai_quota' });
  });

  it('refuses a collaborator’s read rather than spend the owner’s credit uncounted when the diagram cannot be asked', async () => {
    grant = grantOn('user_collaborator');
    roomDown = true;
    const res = await read({ documentId: DOC, read: READ }, { account: 'user_collaborator' });
    expect(await res.json()).toEqual({ error: 'ai_quota' });
    expect(order).toEqual([]);
  });

  it('tells the numbers of a used month to the payer and the paying team alone', async () => {
    used.set('p:user_owner', 50);
    grant = grantOn(OWNER);
    const own = await read({ documentId: DOC, read: READ }, { account: OWNER });
    expect(await own.json()).toEqual({
      error: 'ai_credits_used',
      limit: 'aiCreditsPerMonth',
      used: 50,
      max: 50,
      owner: 'p:user_owner',
    });
    grant = grantOn('user_collaborator');
    const other = await read({ documentId: DOC, read: READ }, { account: 'user_collaborator' });
    expect(await other.json()).toEqual({
      error: 'ai_credits_used',
      limit: 'aiCreditsPerMonth',
      owner: 'p:user_owner',
    });
  });

  it("is the team for a team's diagram, also when the reader has Pro of their own", async () => {
    grant = grantOn('user_pro', { team: 'team_garden' });
    const member = await read(
      { documentId: DOC, read: READ },
      { account: 'user_pro', teams: [{ id: 'team_garden', name: 'Garden', role: 'member' }] },
    );
    expect(await credits(member)).toMatchObject({ owner: 't:team_garden', used: 1, max: 50 });
    const outsider = await read({ documentId: DOC, read: 'read-0002' }, { account: 'user_other' });
    expect(await credits(outsider)).toEqual({
      owner: 't:team_garden',
      pass: expect.any(String),
      cost: 1,
    });
    expect([...used.keys()]).toEqual(['t:team_garden']);
  });

  it('is never what the request claims', async () => {
    grant = grantOn('user_collaborator');
    await read(
      {
        documentId: DOC,
        read: READ,
        tier: 'pro',
        owner: 'p:user_rich',
        credits: { owner: 'p:user_rich' },
      },
      { account: 'user_collaborator' },
    );
    expect(order).toEqual(['spend:p:user_owner', 'model']);
  });

  it('is the signed-in reader with no diagram or no Editor grant on it, and nobody for a guest’s diagram', async () => {
    await read({ read: READ }, { account: 'user_a' });
    grant = null;
    await read({ documentId: DOC, read: READ }, { account: 'user_b' });
    grant = grantOn('user_c', {}, 'view');
    await read({ documentId: DOC, read: READ }, { account: 'user_c' });
    // A guest's diagram is never sent to the subscription service: nobody's credit, the gate alone.
    grant = grantOn('user_d', { owner: 'guest_00000000-0000-4000-8000-000000000001' });
    const guestOwned = await read({ documentId: DOC, read: READ }, { account: 'user_d' });
    expect(await credits(guestOwned)).toBeUndefined();
    grant = grantOn('user_e', { trashed: true });
    await read({ documentId: DOC, read: READ }, { account: 'user_e' });
    grant = new Response(null, { status: 401 });
    await read({ documentId: DOC, read: READ }, { account: 'user_f' });
    grant = new Error('index unavailable');
    await read({ documentId: DOC, read: READ }, { account: 'user_g' });
    grant = grantOn('user_h', { owner: null });
    await read({ documentId: DOC, read: READ }, { account: 'user_h' });
    await read({ documentId: 7, read: READ }, { account: 'user_h' });
    await read({ documentId: 'x'.repeat(201), read: READ }, { account: 'user_h' });
    expect(order.filter((o) => o.startsWith('spend'))).toEqual(
      ['a', 'b', 'c', 'e', 'f', 'g', 'h', 'h', 'h'].map((who) => `spend:p:user_${who}`),
    );
  });

  it('is nobody for a guest with no owner to charge: no credit, the gate alone', async () => {
    const res = await read({}, { account: null });
    expect(res.status).toBe(200);
    expect(await credits(res)).toBeUndefined();
    expect(order).toEqual(['model']);
  });
});

describe('the pass is bounded by the notes paid for', () => {
  const crops = (...ids: number[]) => ids.map((id) => ({ id, image: TINY_JPEG }));

  it('covers the found notes and the boxes drawn within what the credits paid for', async () => {
    grant = grantOn(OWNER);
    // 10 notes, 1 credit: notes 0 to 9, and drawn boxes -1 to -24.
    const first = await credits(
      await read({ documentId: DOC, read: READ, crops: crops(0, 1, 2) }, { account: OWNER }),
    );
    for (const ids of [[9], [-1, -24], [3, 4, 5, 6, 7, 8]]) {
      const res = await read(
        { documentId: DOC, read: READ, pass: first?.pass, crops: crops(...ids) },
        { account: OWNER },
      );
      expect(res.status).toBe(200);
    }
    expect(used.get('p:user_owner')).toBe(1);
  });

  it('refuses a crop past the notes paid for, with or without a pass, before anything is spent', async () => {
    grant = grantOn(OWNER);
    const pass = (await credits(await read({ documentId: DOC, read: READ }, { account: OWNER })))!
      .pass!;
    for (const ids of [[10], [0, 50], [-25], [399]]) {
      for (const withPass of [pass, undefined]) {
        const res = await read(
          { documentId: DOC, read: 'read-0009', pass: withPass, crops: crops(...ids) },
          { account: OWNER },
        );
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'notes_exceeded' });
      }
    }
    expect(used.get('p:user_owner')).toBe(1);
  });

  it('never stretches a pass to a larger count: the count is signed, so claiming more is a new read', async () => {
    grant = grantOn(OWNER);
    limit = 1000;
    const pass = (await credits(
      await read({ documentId: DOC, read: READ, notes: 10 }, { account: OWNER }),
    ))!.pass!;
    const more = await read(
      { documentId: DOC, read: READ, notes: 100, pass, crops: crops(60) },
      { account: OWNER },
    );
    expect(await credits(more)).toMatchObject({ cost: 5 });
    expect(used.get('p:user_owner')).toBe(1 + 5);
  });
});

describe('a read is paid for once', () => {
  it('lets the later requests of the same read through on its pass', async () => {
    grant = grantOn(OWNER);
    const first = await credits(await read({ documentId: DOC, read: READ }, { account: OWNER }));
    const again = await read(
      { documentId: DOC, read: READ, pass: first?.pass },
      { account: OWNER },
    );
    expect(await credits(again)).toEqual({ owner: 'p:user_owner', pass: first?.pass, cost: 1 });
    expect(used.get('p:user_owner')).toBe(1);
  });

  it('spends again for another read, another payer, a lapsed pass or a forged one', async () => {
    grant = grantOn(OWNER);
    const pass = (await credits(await read({ documentId: DOC, read: READ }, { account: OWNER })))!
      .pass!;
    // Another photo.
    await read({ documentId: DOC, read: 'read-0002', pass }, { account: OWNER });
    // The same read, charged to someone else (no diagram named: the reader's own).
    await read({ read: READ, pass }, { account: 'user_reader' });
    // Forged, malformed, or no id to hold it against.
    for (const bad of [`${START + READ_PASS_MS}.forged`, 'nonsense', 7, 'x'.repeat(200)]) {
      await read({ documentId: DOC, read: READ, pass: bad }, { account: OWNER });
    }
    // Ten minutes on.
    vi.setSystemTime(START + READ_PASS_MS);
    await read({ documentId: DOC, read: READ, pass }, { account: OWNER });
    expect(used.get('p:user_owner')).toBe(1 + 1 + 4 + 1);
    expect(used.get('p:user_reader')).toBe(1);
  });

  it('refuses a charged read that names no read, rather than spend a credit on every request', async () => {
    grant = grantOn(OWNER);
    for (const body of [{ documentId: DOC }, { documentId: DOC, read: 'short' }, { read: 7 }]) {
      const res = await read(body, { account: OWNER });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'read_required' });
    }
    expect(order).toEqual([]);
    // With Pro off nothing is asked of a read at all.
    expect(
      (await read({ documentId: DOC }, { account: OWNER }, { PRO_ENABLED: 'false' })).status,
    ).toBe(200);
  });

  it('gives no pass on a deployment with no key to sign one', async () => {
    grant = grantOn(OWNER);
    const keyless = await read(
      { documentId: DOC, read: READ },
      { account: OWNER },
      { SUBSCRIPTION_KEY: undefined },
    );
    // No key, so nothing can be asked of the service either: the read goes ahead uncounted.
    expect(await credits(keyless)).toEqual({ owner: 'p:user_owner', cost: 1 });
  });

  it('seals a pass to its payer, its read and its hour', async () => {
    const pass = await sealReadPass('k', 'p:user_owner', READ, 30, START + 1000);
    expect(await readPassHolds('k', 'p:user_owner', READ, 30, pass, START)).toBe(true);
    expect(await readPassHolds('k', 'p:user_owner', READ, 30, pass, START + 1000)).toBe(false);
    expect(await readPassHolds('other', 'p:user_owner', READ, 30, pass, START)).toBe(false);
    expect(await readPassHolds('k', 't:team_garden', READ, 30, pass, START)).toBe(false);
    // Sealed for 30 notes, never a pass for another count.
    expect(await readPassHolds('k', 'p:user_owner', READ, 400, pass, START)).toBe(false);
  });

  it('never signs a pass with the bearer key itself: the signing key is derived from it', async () => {
    const lapses = START + 1000;
    const pass = await sealReadPass('k', 'p:user_owner', READ, 30, lapses);
    const hmac = async (secret: string, message: string) => {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)),
      );
      return btoa(String.fromCharCode(...sig))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
    };
    const message = `read|p:user_owner|${READ}|30|${lapses}`;
    // What the bearer key itself would sign is not the pass.
    expect(pass).not.toBe(`${lapses}.${await hmac('k', message)}`);
    // The pass is signed with HMAC(key, the fixed label).
    const derived = await hmac('k', 'livediagram:read-pass:v1');
    expect(pass).toBe(`${lapses}.${await hmac(derived, message)}`);
  });
});
