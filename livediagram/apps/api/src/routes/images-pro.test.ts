import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_MAX_BYTES,
  limitsFor,
  type OwnerScope,
  type Tier,
} from '@liveworkspace/subscription';
import { makeTestRouteContext } from './test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor, type TestMediaService } from '../test-media-service';
import { clearMediaOwnersForTests } from '../media';
import type { Env } from '../types';

// POST and GET /api/images with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on"), over the real
// media service in this process: the uploader's limit read from entitlements before the body, the item's owner named
// from the index's grant and never from the request, and the gallery's storage passed on.

const { resolveDocumentGrant } = vi.hoisted(() => ({ resolveDocumentGrant: vi.fn() }));
vi.mock('./document-grant', () => ({ resolveDocumentGrant }));

import { handleImages } from './images';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size: number, seed = 1) => {
  const bytes = new Uint8Array(size);
  bytes.set(PNG);
  bytes[size - 1] = seed;
  return bytes;
};
// Largest Image, the same 25 MB on every tier (Free, Pro and Pro for Teams).
const FREE_MAX = IMAGE_MAX_BYTES;

let db: SqliteD1;
let media: TestMediaService;
let tiers: Record<string, Tier>;
let asked: string[];
// Each test's own people: the entitlement cache is the isolate's.
let serial = 0;
const person = () => `user_img${++serial}`;

// Pro on at this api and at the media service, both reading the same stand-in for the subscription service.
function proOn(): Env {
  const vars = {
    PRO_ENABLED: 'true',
    SUBSCRIPTION_KEY: 'sub-key',
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
        asked.push(owner);
        const tier = tiers[owner] ?? 'free';
        return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  };
  Object.assign(media.env, vars);
  return { ...db.env, ...vars };
}

beforeEach(() => {
  db = sqliteD1();
  media = mediaServiceFor(db.env);
  tiers = {};
  asked = [];
  resolveDocumentGrant.mockReset();
  clearMediaOwnersForTests();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllGlobals());

type Sent = { owner: string; env: Env; path?: string; headers?: Record<string, string> };
const upload = (body: Uint8Array | ReadableStream, sent: Sent, declared?: number) => {
  const path = sent.path ?? '/api/images';
  const ctx = makeTestRouteContext('POST', path, { owner: sent.owner, env: sent.env });
  return handleImages({
    ...ctx,
    request: new Request(`https://api.test${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(declared ?? (body instanceof Uint8Array ? body.byteLength : 0)),
        'X-Image-Width': '4',
        'X-Image-Height': '3',
        ...sent.headers,
      },
      body,
      duplex: 'half',
    } as RequestInit),
  });
};

const teamGrant = (level: 'view' | 'participate' | 'edit' = 'edit') => ({
  item: 'doc-1',
  level,
  tab: null,
  sub: 'user_x',
  team: 'team_garden',
  owner: 'user_host',
  exp: 0,
  shareCode: null,
  token: 't',
});

describe('with Pro off', () => {
  it('keeps the 10 MB cap, never reads a grant for the upload and names no item owner', async () => {
    const owner = person();
    const env = { ...db.env, PRO_ENABLED: 'false' };
    expect(
      // Under the legacy 10 MiB.
      (await upload(png(6_000_000), { owner, env, path: '/api/images?d=doc-1' })).status,
    ).toBe(200);
    const over = await upload(png(16), { owner, env }, 10 * 1024 * 1024 + 1);
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: 'file_too_large', limitBytes: 10 * 1024 * 1024 });
    expect(resolveDocumentGrant).not.toHaveBeenCalled();
    const listed = await handleImages(makeTestRouteContext('GET', '/api/images', { owner, env }));
    expect(await listed.json()).not.toHaveProperty('storage');
  });
});

describe('with Pro on', () => {
  it('refuses someone on Free a declared byte past 25 MB before a byte of the body is read', async () => {
    const env = proOn();
    const owner = person();
    let read = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          read = true;
          controller.enqueue(png(64));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const refused = await upload(body, { owner, env }, FREE_MAX + 1);
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({
      error: 'file_too_large',
      limitBytes: FREE_MAX,
      limit: FREE_MAX,
      current: FREE_MAX + 1,
      owner: `p:${owner}`,
    });
    expect(read).toBe(false);
    // And the service was never sent it.
    expect(media.calls).toEqual([]);
  });

  it('takes exactly 25 MB on Free, and stops reading a body that runs past what it declared', async () => {
    const env = proOn();
    const owner = person();
    expect((await upload(png(FREE_MAX), { owner, env })).status).toBe(200);
    const lied = await upload(png(FREE_MAX + 1, 2), { owner, env }, 1024);
    expect(lied.status).toBe(413);
    expect(await lied.json()).toMatchObject({ error: 'file_too_large', limit: FREE_MAX });
  });

  it('takes exactly 25 MB from someone on Pro, and no byte more', async () => {
    const env = proOn();
    const owner = person();
    tiers[`p:${owner}`] = 'pro';
    expect((await upload(png(FREE_MAX), { owner, env })).status).toBe(200);
    const lied = await upload(png(FREE_MAX + 1, 2), { owner, env }, 1024);
    expect(lied.status).toBe(413);
    expect(await lied.json()).toMatchObject({ error: 'file_too_large', limit: FREE_MAX });
  });

  it('holds every uploader to 25 MB, in a Pro for Teams item too', async () => {
    const env = proOn();
    const owner = person();
    tiers['t:team_garden'] = 'team';
    resolveDocumentGrant.mockResolvedValue(teamGrant('participate'));
    const sent = { owner, env, path: '/api/images?d=doc-1' };
    expect((await upload(png(1024), sent)).status).toBe(200);
    expect(resolveDocumentGrant).toHaveBeenCalledWith(expect.anything(), 'doc-1');
    expect(asked).toContain('t:team_garden');
    // Past 25 MB is refused in the team's item, as everywhere.
    expect((await upload(png(16), sent, FREE_MAX + 1)).status).toBe(413);
    // And in an item they can only view, or hold no grant on.
    resolveDocumentGrant.mockResolvedValue(teamGrant('view'));
    expect((await upload(png(16), sent, FREE_MAX + 1)).status).toBe(413);
    resolveDocumentGrant.mockResolvedValue(null);
    expect((await upload(png(16), sent, FREE_MAX + 1)).status).toBe(413);
  });

  it('never takes a tier or an item owner from the browser', async () => {
    const env = proOn();
    const owner = person();
    tiers['t:team_garden'] = 'team';
    const claimed = await upload(png(FREE_MAX + 1), {
      owner,
      env,
      headers: {
        'X-Media-Item-Owner': 't:team_garden',
        'X-Subscription-Tier': 'team',
        'X-Tier': 'pro',
      },
    });
    expect(claimed.status).toBe(413);
    expect(asked).toEqual([`p:${owner}`]);
  });

  it('passes the gallery’s storage on, as the service counted it', async () => {
    const env = proOn();
    const owner = person();
    await upload(png(2000), { owner, env });
    const listed = await handleImages(makeTestRouteContext('GET', '/api/images', { owner, env }));
    expect(await listed.json()).toMatchObject({
      storage: { used: 2000, limit: 500_000_000, maxImageBytes: FREE_MAX, owner: `p:${owner}` },
    });
  });
});
