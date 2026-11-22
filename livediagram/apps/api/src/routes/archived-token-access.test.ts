import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_PUT_AWAY_HEADER } from '@liveworkspace/index-app';
import type { GrantClaims } from '@liveworkspace/index-client';
import { DOC, roomWorld, type RoomWorld } from '../document-room/automations/test-automation-world';
import { clearGrantCacheForTests, setGrantVerifierForTests } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleInternalItems } from './internal-items';

// Work Tracker 1323 (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Where an item stands"): an API
// token's grant is fetched from the index and kept by the worker until a minute before it lapses, so after an archive
// the same token could still read and write the canvas for up to ten minutes. The canvas's room, which hears the
// index's standing call, refuses a grant signed before the canvas was put away, and the worker drops the grant it
// kept. Here a token reads, archives through the api, the index's standing call reaches the room through the internal
// door, and the token's next read, write and room ticket are refused 409 archived; a move out opens it again at once,
// and the Trash answers 410.

const KEY = 'index-key';
const INDEX_ORIGIN = 'https://index.test';
const ITEM = {
  id: DOC,
  app: 'livediagram',
  ownerId: 'owner',
  teamId: null,
  folderId: null,
  title: 'Roadmap',
  createdAt: 1,
  updatedAt: 2,
  archivedAt: null,
};

// The index as the worker reaches it: where the canvas stands, the grants it signed and every grant asked for.
const index = {
  standing: 'live' as 'live' | 'archived' | 'trashed',
  signed: new Map<string, GrantClaims>(),
  grantsAsked: 0,
};

// The index's clock: each grant it signs and each standing it writes a second after the last.
let clock = Date.now();
const tick = () => (clock += 1_000);

function signGrant(trashed: boolean): string {
  const iatMs = tick();
  const token = `G.${index.signed.size + 1}`;
  index.signed.set(token, {
    item: DOC,
    sub: 'owner',
    level: 'edit',
    tab: null,
    team: null,
    owner: 'owner',
    exp: Math.floor(iatMs / 1000) + 600,
    iat: Math.floor(iatMs / 1000),
    iatMs,
    ...(trashed ? { trashed: true } : {}),
  } as GrantClaims);
  return token;
}

function answerIndex(req: Request): Response {
  const path = new URL(req.url).pathname.replace(/^\/api\/index/, '');
  if (path === `/items/${DOC}/grant`) {
    index.grantsAsked += 1;
    // No grant is signed for an archived item; a trashed one's says so.
    if (index.standing === 'archived') return Response.json({ error: 'archived' }, { status: 409 });
    const trashed = index.standing === 'trashed';
    return Response.json({
      grant: signGrant(trashed),
      level: 'edit',
      tabId: null,
      expiresAt: Date.now() + 600_000,
      ...(trashed ? { trashed: true } : {}),
    });
  }
  if (path === `/items/${DOC}/archive`) {
    index.standing = 'archived';
    return Response.json({ item: { ...ITEM, archivedAt: Date.now() } });
  }
  if (path === `/items/${DOC}` && req.method === 'PATCH') {
    index.standing = 'live';
    return Response.json({ item: ITEM });
  }
  return Response.json({ error: 'not_found' }, { status: 404 });
}

let w: RoomWorld;
beforeEach(async () => {
  index.standing = 'live';
  index.signed.clear();
  index.grantsAsked = 0;
  clearGrantCacheForTests();
  setGrantVerifierForTests(async (token: string) => index.signed.get(token) ?? null);
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (new URL(req.url).origin === INDEX_ORIGIN) return answerIndex(req);
    throw new Error(`unexpected fetch ${req.url}`);
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // The canvas's real room, made by its owner.
  w = roomWorld({ INDEX_KEY: KEY, INDEX_ORIGIN });
  await w.create();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setGrantVerifierForTests(null);
});

// The API token's request as the worker takes it: no grant sent, so it fetches (and keeps) one for the token's account.
async function asToken(method: string, path: string, body?: unknown): Promise<Response> {
  const ctx = makeTestRouteContext(method, path, {
    owner: 'owner',
    verifiedUserId: 'owner',
    token: { id: 'tok1', readOnly: false, name: 'MCP' },
    ...(body === undefined ? {} : { body }),
  });
  return handleDocuments({ ...ctx, env: w.env });
}

// The index's standing call, as it reaches this api's internal door after the batch that changed it.
async function standing(archived: boolean, trashed: boolean): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const res = await handleInternalItems(
    new Request(`https://api.test/api/internal/items/${DOC}/standing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived, trashed, at: tick() }),
    }),
    w.env,
    (p) => void pending.push(p),
  );
  expect(res.status).toBe(200);
  await Promise.all(pending);
}

const read = () => asToken('GET', `/api/documents/${DOC}`);
const write = () => asToken('PUT', `/api/documents/${DOC}`, { name: 'Changed' });
const errorOf = async (res: Response) => (await res.json<{ error?: string }>()).error;

describe("an archived canvas and its API token's kept grant", () => {
  it('refuses the next read, write and room ticket 409 archived, and opens again on a move out', async () => {
    expect((await read()).status).toBe(200);
    expect(index.grantsAsked).toBe(1);

    // Archived through the api (the MCP's archive_document), and the index tells the canvas where it stands.
    expect((await asToken('POST', `/api/documents/${DOC}/archive`)).status).toBe(200);
    await standing(true, false);

    // The grant the worker kept is refused by the room, not the worker: it decides where every isolate's requests meet.
    const refused = await read();
    expect(refused.status).toBe(409);
    expect(await errorOf(refused)).toBe('archived');
    expect(refused.headers.get(ITEM_PUT_AWAY_HEADER)).toBe('archived');
    expect(index.grantsAsked).toBe(1);
    // Dropped: the next call asks the index, which refuses an archived canvas itself.
    const written = await write();
    expect(written.status).toBe(409);
    expect(await errorOf(written)).toBe('archived');
    expect(index.grantsAsked).toBe(2);
    expect((await asToken('POST', `/api/documents/${DOC}/room-ticket`)).status).toBe(409);

    // Moved out of Archived: open at once.
    expect((await asToken('POST', `/api/documents/${DOC}/unarchive`)).status).toBe(200);
    await standing(false, false);
    expect((await read()).status).toBe(200);
    expect((await write()).status).toBe(200);
  });

  it('refuses a grant kept from before a move out lost twice, once, then mends', async () => {
    expect((await read()).status).toBe(200);
    await standing(true, false);
    // The index moved it out, but its standing call never reached the room.
    index.standing = 'live';
    expect((await read()).status).toBe(409);
    // The next call asks the index, whose fresh grant tells the room the canvas is back.
    expect((await read()).status).toBe(200);
    expect((await read()).status).toBe(200);
  });

  it('answers a grant kept from before the Trash 410, and a restore opens it again', async () => {
    expect((await read()).status).toBe(200);
    index.standing = 'trashed';
    await standing(false, true);
    const refused = await write();
    expect(refused.status).toBe(410);
    expect(await errorOf(refused)).toBe('document_trashed');
    expect(refused.headers.get(ITEM_PUT_AWAY_HEADER)).toBe('trashed');
    // The index's own trashed grant answers the same.
    expect((await read()).status).toBe(410);
    expect((await asToken('POST', `/api/documents/${DOC}/room-ticket`)).status).toBe(410);
    index.standing = 'live';
    await standing(false, false);
    expect((await read()).status).toBe(200);
  });

  it('leaves a canvas that never heard alone: the kept grant reads as before', async () => {
    expect((await read()).status).toBe(200);
    index.standing = 'archived';
    expect((await read()).status).toBe(200);
    expect(index.grantsAsked).toBe(1);
  });
});
