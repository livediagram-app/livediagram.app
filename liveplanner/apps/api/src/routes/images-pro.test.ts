import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { IMAGE_UPLOAD_CEILING_BYTES, MAX_IMAGE_BYTES } from '@liveworkspace/media';
import { ITEM_ATTACHMENT_BYTES_MAX } from '@liveplanner/items';
import {
  IMAGE_MAX_BYTES,
  limitsFor,
  type OwnerScope,
  type Tier,
} from '@liveworkspace/subscription';
import { clearMediaOwnersForTests, MEDIA_APP } from '../media';
import { setGrantVerifierForTests } from '../index-service';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// POST and GET /api/images with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on";
// docs/specs/026-plan/item-types.md "Image fields"): the uploader's limit is the better of their own tier and the
// plan's owner's, read from entitlements and the index's grant before a byte of the body, never from the request; the
// plan's owner is named to the service; the gallery's storage is passed on. With Pro off nothing is asked.

// `Bearer guest:<id>` stands in for a verified guest token (the worker's own path).
vi.mock('../auth/accounts', () => ({
  getPersonIdentity: async (_env: unknown, request: Request) => {
    const bearer = request.headers.get('Authorization') ?? '';
    return bearer.startsWith('Bearer guest:')
      ? { kind: 'guest', guestId: bearer.slice('Bearer guest:'.length) }
      : null;
  },
  accountCredentials: () => null,
}));

import worker from '../index';
import { handleImages } from './images';

const PLAN = 'plan-1';
const MEDIA_URL = 'https://media.test/api/media';
// Largest Image, the same 25 MB on every tier (Free, Pro and Pro for Teams).
const FREE_MAX = IMAGE_MAX_BYTES;
// Between Free's old 5 MB and the legacy cap: under the legacy 10 MiB.
const UNDER_LEGACY = 6_000_000;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set(PNG);
  return bytes;
};

// The index's grant, signed by a stand-in: `person` holds `level` on the plan, which `owner` or `team` owns.
const grantOf = (
  person: string,
  level: string,
  whose: { owner?: string; team?: string | null } = {},
) =>
  `G.${btoa(
    JSON.stringify({
      item: PLAN,
      sub: person,
      level,
      tab: null,
      team: whose.team ?? null,
      owner: whose.owner ?? 'user_host',
      exp: 9e9,
    }),
  )}`;

let tiers: Record<string, Tier>;
let asked: string[];
let uploads: { owner: string | null; itemOwner: string | null; bytes: number }[];
let env: Env;
// Each test's own people: the entitlement cache is the isolate's.
let serial = 0;
const person = () => `user_planimg${++serial}`;

const room = { grantImage: async () => undefined, community: async () => null };

function world(pro: boolean): Env {
  return {
    MEDIA_URL,
    MEDIA_KEY: 'media-key',
    INDEX_ORIGIN: 'https://index.test',
    PLAN_ROOM: { idFromName: (name: string) => name, get: () => room },
    PRO_ENABLED: pro ? 'true' : 'false',
    SUBSCRIPTION_KEY: 'sub-key',
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
        asked.push(owner);
        const tier = tiers[owner] ?? 'free';
        return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  } as unknown as Env;
}

beforeEach(() => {
  tiers = {};
  asked = [];
  uploads = [];
  clearMediaOwnersForTests();
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  // The media service, as far as these calls need it: it takes what it is sent and says what it was told.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (!req.url.startsWith(MEDIA_URL))
      return Response.json({ error: 'not_found' }, { status: 404 });
    const owner = url.searchParams.get('owner');
    if (req.method === 'POST') {
      const bytes = (await req.arrayBuffer()).byteLength;
      uploads.push({ owner, itemOwner: req.headers.get('X-Media-Item-Owner'), bytes });
      return Response.json({
        image: {
          id: `img-${uploads.length}`,
          contentType: 'image/png',
          byteSize: bytes,
          width: 4,
          height: 3,
          createdAt: 1,
          app: MEDIA_APP,
        },
        deduped: false,
      });
    }
    return Response.json({
      images: [],
      ...(env.PRO_ENABLED === 'true'
        ? {
            storage: {
              used: 2000,
              limit: 500_000_000,
              maxImageBytes: FREE_MAX,
              owner: `p:${owner}`,
            },
          }
        : {}),
    });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setGrantVerifierForTests(null);
});

type Sent = { owner: string; grant?: string; plan?: boolean; headers?: Record<string, string> };
// The route itself, as `owner` (an account), for plan `p` unless `plan` is false.
const upload = (body: Uint8Array | ReadableStream, sent: Sent, declared?: number) => {
  const path = sent.plan === false ? '/api/images' : `/api/images?p=${PLAN}`;
  const ctx = makeTestRouteContext('POST', path, { owner: sent.owner, env, grant: null });
  return handleImages({
    ...ctx,
    request: new Request(`https://api.test${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(declared ?? (body instanceof Uint8Array ? body.byteLength : 0)),
        'X-Image-Width': '4',
        'X-Image-Height': '3',
        ...(sent.grant ? { 'X-Index-Grant': sent.grant } : {}),
        ...sent.headers,
      },
      body,
      duplex: 'half',
    } as RequestInit),
  });
};

describe('a card’s Attachments', () => {
  it('may state a size up to the most any tier uploads, so a Pro upload joins a card', () => {
    expect(ITEM_ATTACHMENT_BYTES_MAX).toBe(IMAGE_UPLOAD_CEILING_BYTES);
    expect(ITEM_ATTACHMENT_BYTES_MAX).toBe(IMAGE_MAX_BYTES);
  });
});

describe('with Pro off', () => {
  it('keeps the 10 MB cap, asks the subscription service nothing and names no plan owner', async () => {
    env = world(false);
    const owner = person();
    const grant = grantOf(owner, 'edit', { team: 'team_garden' });
    expect((await upload(png(UNDER_LEGACY), { owner, grant })).status).toBe(200);
    const over = await upload(png(16), { owner, grant }, MAX_IMAGE_BYTES + 1);
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES });
    expect(asked).toEqual([]);
    expect(uploads).toEqual([{ owner, itemOwner: null, bytes: UNDER_LEGACY }]);
    const listed = await handleImages(makeTestRouteContext('GET', '/api/images', { owner, env }));
    expect(await listed.json()).toEqual({ images: [] });
  });
});

describe('with Pro on', () => {
  it('refuses someone on Free a declared byte past 25 MB before a byte of the body is read', async () => {
    env = world(true);
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
    const refused = await upload(body, { owner, plan: false }, FREE_MAX + 1);
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({
      error: 'file_too_large',
      limitBytes: FREE_MAX,
      limit: FREE_MAX,
      current: FREE_MAX + 1,
      owner: `p:${owner}`,
    });
    expect(read).toBe(false);
    expect(uploads).toEqual([]);
  });

  it('takes exactly 25 MB on Free, and stops reading a body that runs past what it declared', async () => {
    env = world(true);
    const owner = person();
    expect((await upload(png(FREE_MAX), { owner, plan: false })).status).toBe(200);
    const lied = await upload(png(FREE_MAX + 1), { owner, plan: false }, 1024);
    expect(lied.status).toBe(413);
    expect(await lied.json()).toMatchObject({ error: 'file_too_large', limit: FREE_MAX });
    expect(uploads).toHaveLength(1);
  });

  it('takes exactly 25 MB from someone on Pro, in a Free owner’s plan too, and no byte more', async () => {
    env = world(true);
    const owner = person();
    tiers[`p:${owner}`] = 'pro';
    const sent = { owner, grant: grantOf(owner, 'participate', { owner: 'user_freehost' }) };
    expect((await upload(png(FREE_MAX), sent)).status).toBe(200);
    expect((await upload(png(16), sent, FREE_MAX + 1)).status).toBe(413);
    const lied = await upload(png(FREE_MAX + 1), sent, 1024);
    expect(lied.status).toBe(413);
    expect(await lied.json()).toMatchObject({ error: 'file_too_large', limit: FREE_MAX });
  });

  it('holds every uploader to 25 MB in a Pro for Teams plan, and names the team to the service', async () => {
    env = world(true);
    const owner = person();
    tiers['t:team_garden'] = 'team';
    const whose = { team: 'team_garden' };
    const sent = { owner, grant: grantOf(owner, 'participate', whose) };
    expect((await upload(png(1024), sent)).status).toBe(200);
    expect(uploads).toEqual([{ owner, itemOwner: 't:team_garden', bytes: 1024 }]);
    // Past 25 MB is refused in the team's plan, as everywhere.
    expect((await upload(png(16), sent, FREE_MAX + 1)).status).toBe(413);
    // A plan they can only view: the limit is met before who may upload is asked.
    const viewer = { owner, grant: grantOf(owner, 'view', whose) };
    expect((await upload(png(16), viewer, FREE_MAX + 1)).status).toBe(413);
    expect((await upload(png(16), viewer)).status).toBe(403);
    // Nor does a plan they hold no grant on take more.
    expect((await upload(png(16), { owner }, FREE_MAX + 1)).status).toBe(413);
    expect(uploads).toHaveLength(1);
  });

  it('holds a person’s plan to 25 MB whatever its owner’s tier, and names the owner', async () => {
    env = world(true);
    const owner = person();
    const sent = { owner, grant: grantOf(owner, 'edit', { owner: person() }) };
    const refused = await upload(png(16), sent, FREE_MAX + 1);
    expect(refused.status).toBe(413);
    expect(await refused.json()).toMatchObject({ limit: FREE_MAX, owner: `p:${owner}` });
    // In a Pro owner's plan the same Free uploader is held to the same 25 MB, and the owner is named.
    const paid = person();
    tiers[`p:${paid}`] = 'pro';
    const paidPlan = { owner, grant: grantOf(owner, 'edit', { owner: paid }) };
    expect((await upload(png(16), paidPlan, FREE_MAX + 1)).status).toBe(413);
    const allowed = await upload(png(1024), paidPlan);
    expect(allowed.status).toBe(200);
    expect(uploads.at(-1)).toMatchObject({ owner, itemOwner: `p:${paid}` });
  });

  it('never takes a tier or a plan owner from the browser', async () => {
    env = world(true);
    const owner = person();
    tiers['t:team_garden'] = 'team';
    const claimed = await upload(png(FREE_MAX + 1), {
      owner,
      plan: false,
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
    env = world(true);
    const owner = person();
    const listed = await handleImages(makeTestRouteContext('GET', '/api/images', { owner, env }));
    expect(await listed.json()).toEqual({
      images: [],
      storage: { used: 2000, limit: 500_000_000, maxImageBytes: FREE_MAX, owner: `p:${owner}` },
    });
  });

  it('lets an upload past the legacy 10 MB through the gate before the routes, for its route to judge', async () => {
    env = world(true);
    tiers['t:team_garden'] = 'team';
    const send = (bytes: Uint8Array, team: string | null) =>
      worker.fetch(
        new Request(`https://api.test/api/images?p=${PLAN}`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer guest:gus',
            'X-Index-Grant': grantOf('gus', 'participate', { team }),
            'Content-Type': 'image/png',
            'Content-Length': String(bytes.byteLength),
            'X-Image-Width': '4',
            'X-Image-Height': '3',
          },
          body: bytes,
        }),
        env,
      );
    // A guest (Free) sends 11 MB, in a team's plan and in a Free owner's plan alike.
    expect((await send(png(MAX_IMAGE_BYTES + 1_000_000), 'team_garden')).status).toBe(200);
    expect((await send(png(MAX_IMAGE_BYTES + 1_000_000), null)).status).toBe(200);
    // Past 25 MB, the most any tier takes, the gate itself stops it, before any route.
    const refused = await send(png(FREE_MAX + 1), 'team_garden');
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({ error: 'payload_too_large' });
  });
});
