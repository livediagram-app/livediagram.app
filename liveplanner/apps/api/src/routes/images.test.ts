import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { MAX_IMAGE_BYTES, ORIGINAL_NAME_MAX, mediaGuestOwner } from '@liveworkspace/media';
import { MAX_BODY_BYTES } from '../limits';
import { clearMediaOwnersForTests, MEDIA_APP } from '../media';
import { setGrantVerifierForTests } from '../index-service';
import { IMAGE_ID_MAX } from '../plan-room/image-grants';
import type { Env } from '../types';
import type { WorkbenchContext } from './context';
import { makeTestRouteContext } from './test-route-context';

// The pictures of Image fields (docs/specs/026-plan/item-types.md "Image fields"), through the real worker: an upload
// for a plan by someone who may write its cards, recorded as a grant in the plan's room, and the byte read, to the
// uploader or to anyone who may read a plan that serves the picture. The media service, the index and the plan's
// room are stood in for (the room's own answer is plan-room/image-grants.test.ts's).

const { pushPersonEvents } = vi.hoisted(() => ({ pushPersonEvents: vi.fn(async () => {}) }));
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  indexAppClient: () => ({ pushPersonEvents }),
}));

// `Bearer guest:<id>` stands in for a verified guest token; no Authorization is nobody (a link visitor).
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
import { handleImages, originalNameOf } from './images';

const PLAN = 'plan-1';
const MEDIA_URL = 'https://media.test/api/media';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

// The index's grants, signed by a stand-in (`G.<claims>`): `person` holds `level` on `item`, on one tab or all.
const grantOf = (person: string, level: string, item = PLAN, tab: string | null = null) =>
  `G.${btoa(JSON.stringify({ item, sub: person, level, tab, team: null, exp: 9e9 }))}`;

// The media service, as far as these calls need it: a gallery per owner, deduped by bytes.
type Stored = { id: string; owner: string; bytes: Uint8Array; contentType: string };
let stored: Map<string, Stored>;
let serviceCalls: { method: string; path: string; headers: Headers }[];
let refuseUpload: { status: number; body: Record<string, unknown> } | null;
// The grant requests that reached the index (a caller who sent none), and how it answers them.
let indexGrantAsks: string[];
let indexGrantAnswer: { status: number; body: Record<string, unknown> };

// The plan's room: what it was told and what it answers.
let granted: string[];
let serves: boolean;
const room = {
  grantImage: vi.fn(async (_plan: string, id: string) => void granted.push(id)),
  servesImage: vi.fn(async () => serves),
};

let env: Env;

beforeEach(() => {
  stored = new Map();
  serviceCalls = [];
  refuseUpload = null;
  indexGrantAsks = [];
  indexGrantAnswer = { status: 404, body: { error: 'not_found' } };
  granted = [];
  serves = true;
  room.grantImage.mockClear();
  room.servesImage.mockClear();
  pushPersonEvents.mockClear();
  clearMediaOwnersForTests();
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  env = {
    MEDIA_URL,
    MEDIA_KEY: 'media-key',
    INDEX_ORIGIN: 'https://index.test',
    PLAN_ROOM: { idFromName: (name: string) => name, get: () => room },
  } as unknown as Env;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (req.url.startsWith(MEDIA_URL)) return media(req, url);
    if (/\/grant$/.test(url.pathname)) {
      indexGrantAsks.push(url.pathname);
      return Response.json(indexGrantAnswer.body, { status: indexGrantAnswer.status });
    }
    throw new Error(`unexpected fetch ${req.url}`);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setGrantVerifierForTests(null);
});

async function media(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.slice(new URL(MEDIA_URL).pathname.length);
  serviceCalls.push({ method: req.method, path, headers: req.headers });
  const image = (s: Stored) => ({
    id: s.id,
    contentType: s.contentType,
    byteSize: s.bytes.byteLength,
    width: 4,
    height: 3,
    createdAt: 1,
    app: MEDIA_APP,
  });
  if (req.method === 'POST' && path === '/app/images') {
    if (refuseUpload) return Response.json(refuseUpload.body, { status: refuseUpload.status });
    const owner = url.searchParams.get('owner')!;
    const bytes = new Uint8Array(await req.arrayBuffer());
    const same = [...stored.values()].find(
      (s) => s.owner === owner && s.bytes.join() === bytes.join(),
    );
    if (same) return Response.json({ image: image(same), deduped: true });
    const s = {
      id: `img-${stored.size + 1}`,
      owner,
      bytes,
      contentType: req.headers.get('Content-Type')!,
    };
    stored.set(s.id, s);
    return Response.json({ image: image(s), deduped: false });
  }
  const bytesOf = /^\/app\/images\/([^/]+)\/bytes$/.exec(path);
  if (bytesOf) {
    const s = stored.get(decodeURIComponent(bytesOf[1]!));
    if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
    return new Response(s.bytes, {
      headers: { 'Content-Type': s.contentType, 'X-Media-Owner': s.owner },
    });
  }
  const one = /^\/app\/images\/([^/]+)$/.exec(path);
  if (one) {
    const s = stored.get(decodeURIComponent(one[1]!));
    if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ image: image(s), owner: s.owner });
  }
  throw new Error(`unexpected media call ${req.method} ${path}`);
}

type Who = { person?: string | null; grant?: string | null; headers?: Record<string, string> };

const identity = ({ person = 'alice', grant = null }: Who) => ({
  ...(person ? { Authorization: `Bearer guest:${person}` } : {}),
  ...(grant ? { 'X-Index-Grant': grant } : {}),
});

const upload = (who: Who = {}, bytes: Uint8Array = PNG, path = `/api/images?p=${PLAN}`) =>
  worker.fetch(
    new Request(`https://api.test${path}`, {
      method: 'POST',
      headers: {
        ...identity(who),
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
        'X-Image-Width': '4',
        'X-Image-Height': '3',
        ...who.headers,
      },
      body: bytes,
    }),
    env,
  );

const read = (id: string, who: Who = {}, query = `?p=${PLAN}`) =>
  worker.fetch(
    new Request(`https://api.test/api/images/${id}${query}`, {
      headers: { ...identity(who), ...who.headers },
    }),
    env,
  );

// Alice uploads for the plan she edits; answers the picture's id.
async function uploaded(person = 'alice'): Promise<string> {
  const res = await upload({ person, grant: grantOf(person, 'edit') });
  expect(res.status).toBe(200);
  return (await res.json<{ image: { id: string } }>()).image.id;
}

describe('without the media service', () => {
  it('answers 503 images_unavailable to an upload and a read', async () => {
    env = { ...env, MEDIA_KEY: undefined };
    for (const res of [await upload({ grant: grantOf('alice', 'edit') }), await read('img-1')]) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'images_unavailable' });
    }
  });
});

describe('POST /api/images?p=', () => {
  it("uploads into the uploader's gallery, grants the plan, and answers { image, deduped }", async () => {
    const res = await upload({ grant: grantOf('alice', 'edit') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { image: Record<string, unknown>; deduped: boolean };
    expect(body.deduped).toBe(false);
    expect(body.image).toMatchObject({ id: 'img-1', contentType: 'image/png', width: 4 });
    expect(body.image).not.toHaveProperty('app');
    expect(granted).toEqual(['img-1']);
    // A guest is named at the service by a hash of this app and their id, never the id itself.
    expect(stored.get('img-1')!.owner).toBe(await mediaGuestOwner(MEDIA_APP, 'alice'));
  });

  it("puts a new upload on the uploader's Timeline, and not the same bytes again (granted again)", async () => {
    await uploaded();
    const again = (await (await upload({ grant: grantOf('alice', 'edit') })).json()) as {
      deduped: boolean;
    };
    expect(again.deduped).toBe(true);
    expect(granted).toEqual(['img-1', 'img-1']);
    expect(pushPersonEvents).toHaveBeenCalledTimes(1);
  });

  describe('who may upload (docs/specs/013-workspace/share-roles.md)', () => {
    it('an Editor and a Participant, a Participant on one tab too', async () => {
      for (const grant of [
        grantOf('bob', 'edit'),
        grantOf('bob', 'participate'),
        grantOf('bob', 'participate', PLAN, 'tab-1'),
      ]) {
        expect((await upload({ person: 'bob', grant })).status).toBe(200);
      }
    });

    it('not a Viewer (403), and nothing reaches the service or the plan', async () => {
      const res = await upload({ person: 'vic', grant: grantOf('vic', 'view') });
      expect(res.status).toBe(403);
      expect(serviceCalls).toEqual([]);
      expect(granted).toEqual([]);
    });

    it('not someone without access (404): the index gives them no grant', async () => {
      const res = await upload({ person: 'eve' });
      expect(res.status).toBe(404);
      expect(indexGrantAsks).toEqual([`/api/index/items/${PLAN}/grant`]);
      expect(serviceCalls).toEqual([]);
    });

    it('not with a grant on another plan (404)', async () => {
      const res = await upload({ grant: grantOf('alice', 'edit', 'other-plan') });
      expect(res.status).toBe(404);
    });

    it("passes on the index's password refusal on a protected link", async () => {
      indexGrantAnswer = { status: 401, body: { error: 'password_required' } };
      const res = await upload({ headers: { 'X-Share-Code': 'code-1' } });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'password_required' });
    });

    it('400 with no identity', async () => {
      const res = await upload({ person: null, grant: grantOf('alice', 'edit') });
      expect(res.status).toBe(400);
    });
  });

  it("without p (a This Browser plan), only into the uploader's gallery; 404 for an overlong p", async () => {
    const grant = grantOf('alice', 'edit');
    const res = await upload({}, PNG, '/api/images');
    expect(res.status).toBe(200);
    expect(granted).toEqual([]);
    expect(indexGrantAsks).toEqual([]);
    const long = 'p'.repeat(201);
    expect((await upload({ grant }, PNG, `/api/images?p=${long}`)).status).toBe(404);
  });

  it('415 for a type the service does not take, naming the ones it does', async () => {
    const res = await upload({
      grant: grantOf('alice', 'edit'),
      headers: { 'Content-Type': 'image/svg+xml' },
    });
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ error: 'unsupported_type' });
  });

  it('refuses a request naming no type (415) or no readable length (400)', async () => {
    const call = (headers: Record<string, string>) => {
      const ctx = makeTestRouteContext('POST', `/api/images?p=${PLAN}`, { owner: 'alice', env });
      return handleImages({
        ...ctx,
        request: new Request(ctx.url, {
          method: 'POST',
          headers: { 'X-Index-Grant': grantOf('alice', 'edit'), ...headers },
        }),
      });
    };
    expect((await call({})).status).toBe(415);
    expect((await call({ 'Content-Type': 'image/png' })).status).toBe(400);
    expect((await call({ 'Content-Type': 'image/png', 'Content-Length': 'many' })).status).toBe(
      400,
    );
    expect(serviceCalls).toEqual([]);
  });

  it('400 for a missing or empty Content-Length', async () => {
    const res = await upload({ grant: grantOf('alice', 'edit') }, new Uint8Array());
    expect(res.status).toBe(400);
  });

  it("takes a picture past the api's own body cap, and refuses one past the image cap", async () => {
    const big = new Uint8Array(MAX_BODY_BYTES + 1);
    expect((await upload({ grant: grantOf('alice', 'edit') }, big)).status).toBe(200);
    const tooBig = await upload(
      {
        grant: grantOf('alice', 'edit'),
        headers: { 'Content-Length': String(MAX_IMAGE_BYTES + 1) },
      },
      PNG,
    );
    expect(tooBig.status).toBe(413);
  });

  it('413 file_too_large when the declared length is past the cap, or the body is', async () => {
    const call = (declared: number, body: Uint8Array) => {
      const ctx = makeTestRouteContext('POST', `/api/images?p=${PLAN}`, {
        owner: 'alice',
        env,
        grant: null,
      });
      return handleImages({
        ...ctx,
        request: new Request(ctx.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(declared),
            'X-Index-Grant': grantOf('alice', 'edit'),
          },
          body,
        }),
      });
    };
    for (const res of [
      await call(MAX_IMAGE_BYTES + 1, PNG),
      await call(10, new Uint8Array(MAX_IMAGE_BYTES + 1)),
    ]) {
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: 'file_too_large', limitBytes: MAX_IMAGE_BYTES });
    }
  });

  it("sends the hash shortcut for the owner's own editor only, never an API token's or a workbench's", async () => {
    const sha = 'a'.repeat(64);
    await upload({ grant: grantOf('alice', 'edit'), headers: { 'X-Image-Sha256': sha } });
    expect(serviceCalls[0]!.headers.get('X-Image-Sha256')).toBe(sha);
    serviceCalls = [];
    const ctx = makeTestRouteContext('POST', `/api/images?p=${PLAN}`, {
      owner: 'user_ada',
      env,
      token: { id: 'tok' },
    });
    await handleImages({
      ...ctx,
      request: new Request(ctx.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(PNG.byteLength),
          'X-Image-Sha256': sha,
          'X-Index-Grant': grantOf('user_ada', 'edit'),
        },
        body: PNG,
      }),
    });
    expect(serviceCalls[0]!.headers.get('X-Image-Sha256')).toBeNull();
  });

  it("passes on the service's refusal (a full gallery), and its own failure as 503", async () => {
    refuseUpload = { status: 409, body: { error: 'gallery_full', limit: 1000 } };
    const full = await upload({ grant: grantOf('alice', 'edit') });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'gallery_full', limit: 1000 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    refuseUpload = { status: 500, body: { error: 'internal' } };
    const down = await upload({ grant: grantOf('alice', 'edit') });
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: 'images_unavailable' });
    expect(granted).toEqual([]);
  });

  it('answers 404 to any other method or path', async () => {
    const other = (method: string, path: string) =>
      worker.fetch(new Request(`https://api.test${path}`, { method, headers: identity({}) }), env);
    expect((await other('GET', '/api/images')).status).toBe(404);
    expect((await other('DELETE', '/api/images/img-1')).status).toBe(404);
    expect((await other('GET', '/api/images/')).status).toBe(404);
    expect((await other('GET', '/api/images/a/b')).status).toBe(404);
  });
});

describe('GET /api/images/{id}', () => {
  it('answers the uploader their picture, with or without a plan, cached privately', async () => {
    const id = await uploaded();
    clearMediaOwnersForTests();
    for (const query of ['', `?p=${PLAN}`]) {
      const res = await read(id, {}, query);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    }
    // The owner shortcut asks nothing of the plan.
    expect(room.servesImage).not.toHaveBeenCalled();
  });

  it('answers every share role of a plan that serves it: Viewer, Participant and Editor', async () => {
    const id = await uploaded();
    for (const level of ['view', 'participate', 'edit']) {
      const res = await read(id, { person: 'bob', grant: grantOf('bob', level) });
      expect(res.status, level).toBe(200);
    }
    expect(room.servesImage).toHaveBeenCalledWith(PLAN, id);
  });

  it('answers a link visitor with no identity, by the plan alone', async () => {
    const id = await uploaded();
    serviceCalls = [];
    const res = await read(id, { person: null, grant: grantOf('link:code', 'view') });
    expect(res.status).toBe(200);
    // Nobody to compare with the owner: the service is asked for the bytes only.
    expect(serviceCalls.map((c) => c.path)).toEqual([`/app/images/${id}/bytes`]);
  });

  it('404 when the plan does not serve it (no grant there, or no card holds it)', async () => {
    const id = await uploaded();
    serves = false;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await read(id, { person: 'bob', grant: grantOf('bob', 'edit') });
    expect(res.status).toBe(404);
  });

  it('404 to a stranger: no plan, a plan they cannot read, or a password refusal', async () => {
    const id = await uploaded();
    expect((await read(id, { person: 'eve' }, '')).status).toBe(404);
    expect((await read(id, { person: 'eve' })).status).toBe(404);
    expect((await read(id, { person: 'eve', grant: grantOf('eve', 'edit', 'other') })).status).toBe(
      404,
    );
    indexGrantAnswer = { status: 401, body: { error: 'password_required' } };
    expect((await read(id, { person: 'eve', headers: { 'X-Share-Code': 'c' } })).status).toBe(404);
    expect(room.servesImage).not.toHaveBeenCalled();
  });

  it('404 for an id the service does not know, an overlong id or plan, and bytes gone since', async () => {
    expect((await read('nope')).status).toBe(404);
    expect((await read('x'.repeat(IMAGE_ID_MAX + 1))).status).toBe(404);
    const id = await uploaded();
    const long = `?p=${'p'.repeat(201)}`;
    expect((await read(id, { person: 'bob', grant: grantOf('bob', 'edit') }, long)).status).toBe(
      404,
    );
    // Deleted at the service after its owner was remembered here.
    stored.delete(id);
    expect((await read(id)).status).toBe(404);
  });

  describe('a project-scope workbench session (docs/specs/013-workspace/workbench-embeds.md)', () => {
    const session = (projectId: string) =>
      ({
        sessionId: 'lvw_s',
        ownerId: 'alice',
        tokenId: 't',
        pairingId: 'p',
        tabId: null,
        origin: 'https://x.test',
        level: 'edit',
        expiresAt: 9e12,
        scope: 'project',
        projectId,
        folderId: null,
      }) as WorkbenchContext;
    const call = (method: string, path: string, workbench: WorkbenchContext, body?: Uint8Array) => {
      const ctx = makeTestRouteContext(method, path, { owner: 'alice', env, workbench });
      return handleImages({
        ...ctx,
        request: new Request(ctx.url, {
          method,
          headers: {
            'X-Index-Grant': grantOf('alice', 'edit'),
            ...(body
              ? { 'Content-Type': 'image/png', 'Content-Length': String(body.byteLength) }
              : {}),
          },
          ...(body ? { body } : {}),
        }),
      });
    };

    it('reads only through its own plan, never by the owner shortcut', async () => {
      const id = await uploaded();
      serves = false;
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect((await call('GET', `/api/images/${id}`, session(PLAN))).status).toBe(404);
      expect((await call('GET', `/api/images/${id}?p=${PLAN}`, session(PLAN))).status).toBe(404);
      serves = true;
      expect((await call('GET', `/api/images/${id}?p=${PLAN}`, session(PLAN))).status).toBe(200);
      expect((await call('GET', `/api/images/${id}?p=${PLAN}`, session('other'))).status).toBe(404);
    });

    it('uploads for its own plan only', async () => {
      expect((await call('POST', `/api/images?p=${PLAN}`, session('other'), PNG)).status).toBe(404);
      expect((await call('POST', '/api/images', session(PLAN), PNG)).status).toBe(404);
      expect((await call('POST', `/api/images?p=${PLAN}`, session(PLAN), PNG)).status).toBe(200);
    });
  });
});

describe('originalNameOf', () => {
  it('decodes the percent-encoded name, keeps a raw one, cuts a long one, and is null when none came', () => {
    expect(originalNameOf(encodeURIComponent('Screenshot 9.41 PM.png'))).toBe(
      'Screenshot 9.41 PM.png',
    );
    expect(originalNameOf('100%.png')).toBe('100%.png');
    expect(Array.from(originalNameOf('é'.repeat(ORIGINAL_NAME_MAX + 5))!)).toHaveLength(
      ORIGINAL_NAME_MAX,
    );
    expect(originalNameOf(null)).toBeNull();
  });
});
