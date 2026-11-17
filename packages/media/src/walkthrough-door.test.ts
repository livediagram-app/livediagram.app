// Each app's walkthrough door (liveworkspace/docs/specs/006-media/walkthroughs.md "Each app's door"): who may list,
// read, record and delete, the closed visits, and the service's answers passed on. Over a fake of the service's calls.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Walkthrough } from './walkthrough';
import type { WalkthroughCalls } from './walkthrough-client';
import {
  handleWalkthroughDoor,
  type WalkthroughAccess,
  type WalkthroughDoorInput,
} from './walkthrough-door';

const W: Walkthrough = {
  id: 'w1',
  item: 'doc',
  title: 'T',
  author: 'Ada',
  durationMs: 1000,
  mediaType: 'audio/webm',
  mediaBytes: 10,
  camera: false,
  createdAt: 1,
  ready: true,
};

const EVENTS = {
  v: 1 as const,
  durationMs: 1000,
  camera: false,
  corner: 'bottom-left' as const,
  startTab: 't',
  hidden: [],
  fingerprints: {},
  events: [],
};

let calls: { [K in keyof WalkthroughCalls]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  calls = {
    list: vi.fn(async () => ({
      ok: true,
      value: {
        walkthroughs: [
          { walkthrough: W, owner: 'me' },
          { walkthrough: { ...W, id: 'w2' }, owner: 'them' },
        ],
      },
    })),
    start: vi.fn(async () => ({ ok: true, value: { walkthrough: { ...W, ready: false } } })),
    upload: vi.fn(async () => ({ ok: true, value: { walkthrough: W } })),
    read: vi.fn(async () => ({
      ok: true,
      value: { walkthrough: W, owner: 'them', events: EVENTS },
    })),
    media: vi.fn(async () => ({
      contentType: 'audio/webm',
      length: 3,
      body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
    })),
    remove: vi.fn(async () => ({ ok: true, value: { ok: true } })),
    purge: vi.fn(),
  };
});

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

const door = (
  over: Partial<WalkthroughDoorInput> & {
    level?: WalkthroughAccess['level'];
    closed?: boolean;
  } = {},
) => {
  const { level = 'edit', closed = false, ...rest } = over;
  return handleWalkthroughDoor({
    method: 'GET',
    path: [],
    itemId: 'doc',
    owner: 'me',
    person: true,
    access: async () => ({ level, closed }),
    calls: calls as unknown as WalkthroughCalls,
    request: new Request('https://app.test/api/walkthroughs?d=doc'),
    json,
    corsHeaders: { 'Access-Control-Allow-Origin': 'https://app.test' },
    ...rest,
  });
};

const body = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe('listing', () => {
  it('names which are yours and which you may delete, and whether you may record', async () => {
    const editor = await body(await door());
    expect(editor).toMatchObject({
      canRecord: true,
      walkthroughs: [
        { id: 'w1', mine: true, canDelete: true },
        { id: 'w2', mine: false, canDelete: true },
      ],
    });
    expect((editor.walkthroughs as object[])[0]).not.toHaveProperty('item');
    const viewer = await body(await door({ level: 'view' }));
    expect(viewer).toMatchObject({
      canRecord: false,
      walkthroughs: [{ canDelete: true }, { canDelete: false }],
    });
    const visitor = await body(await door({ level: 'view', owner: null }));
    expect(visitor).toMatchObject({ walkthroughs: [{ mine: false }, { mine: false }] });
    // An API token or a workbench session never records.
    expect(await body(await door({ person: false }))).toMatchObject({ canRecord: false });
  });

  it('shows nothing to a closed visit, no grant, or without an item or the service', async () => {
    expect((await door({ closed: true })).status).toBe(404);
    expect((await door({ access: async () => null })).status).toBe(404);
    expect((await door({ access: async () => new Response(null, { status: 410 }) })).status).toBe(
      410,
    );
    expect((await door({ itemId: null })).status).toBe(400);
    expect((await door({ calls: null })).status).toBe(503);
    expect((await door({ path: ['a', 'b', 'c'] })).status).toBe(404);
    expect((await door({ path: ['a', 'other'] })).status).toBe(404);
    expect((await door({ path: [''] })).status).toBe(404);
    expect((await door({ method: 'PUT' })).status).toBe(404);
  });

  it('passes a refusal on, and hides one about the service', async () => {
    calls.list.mockResolvedValueOnce({ ok: false, status: 400, body: { error: 'invalid_item' } });
    expect((await door()).status).toBe(400);
    calls.list.mockResolvedValueOnce({ ok: false, status: 500, body: { error: 'x' } });
    const failed = await door();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: 'walkthroughs_unavailable' });
  });
});

describe('recording', () => {
  const post = (payload: unknown, headers: Record<string, string> = {}) =>
    new Request('https://app.test/api/walkthroughs?d=doc', {
      method: 'POST',
      headers,
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  const start = {
    item: 'elsewhere',
    title: 'T',
    mediaType: 'audio/webm',
    mediaBytes: 10,
    events: EVENTS,
  };

  it('starts one on the item the grant was checked on', async () => {
    const res = await door({ method: 'POST', request: post(start) });
    expect(res.status).toBe(201);
    expect(calls.start).toHaveBeenCalledWith('me', expect.objectContaining({ item: 'doc' }));
  });

  it('is an Editor’s, as a person', async () => {
    expect(
      (await door({ method: 'POST', level: 'participate', request: post(start) })).status,
    ).toBe(403);
    expect((await door({ method: 'POST', person: false, request: post(start) })).status).toBe(403);
    expect((await door({ method: 'POST', owner: null, request: post(start) })).status).toBe(403);
  });

  it('refuses a body too big, not JSON, or not a start', async () => {
    const big = post(start, { 'Content-Length': String(3 * 1024 * 1024) });
    expect((await door({ method: 'POST', request: big })).status).toBe(413);
    expect(
      (await door({ method: 'POST', request: post('x'.repeat(3 * 1024 * 1024)) })).status,
    ).toBe(413);
    expect((await door({ method: 'POST', request: post('{') })).status).toBe(400);
    expect(
      (await door({ method: 'POST', request: post({ ...start, mediaType: 'x' }) })).status,
    ).toBe(415);
    const broken = new Request('https://app.test', { method: 'POST', body: 'x' });
    vi.spyOn(broken, 'text').mockRejectedValueOnce(new Error('gone'));
    expect((await door({ method: 'POST', request: broken })).status).toBe(413);
  });

  it('streams the media through, checked first', async () => {
    const put = (headers: Record<string, string>, payload: BodyInit | null = 'abc') =>
      new Request('https://app.test/api/walkthroughs/w1/media?d=doc', {
        method: 'PUT',
        headers,
        body: payload,
      });
    const ok = await door({
      method: 'PUT',
      path: ['w1', 'media'],
      request: put({ 'Content-Type': 'audio/webm;codecs=opus', 'Content-Length': '3' }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ walkthrough: { id: 'w1', mine: true } });
    expect(calls.upload).toHaveBeenCalledWith(
      'me',
      'w1',
      expect.objectContaining({ type: 'audio/webm', length: 3 }),
    );
    const status = async (
      headers: Record<string, string>,
      over: Partial<WalkthroughDoorInput> = {},
      payload: BodyInit | null = 'abc',
    ) =>
      (
        await door({
          method: 'PUT',
          path: ['w1', 'media'],
          request: put(headers, payload),
          ...over,
        })
      ).status;
    expect(await status({ 'Content-Type': 'text/plain', 'Content-Length': '3' })).toBe(400);
    expect(await status({ 'Content-Type': 'audio/webm', 'Content-Length': '0' })).toBe(400);
    expect(
      await status({ 'Content-Type': 'audio/webm', 'Content-Length': String(41 * 1024 * 1024) }),
    ).toBe(413);
    expect(await status({ 'Content-Type': 'audio/webm', 'Content-Length': '3' }, {}, null)).toBe(
      400,
    );
    expect(
      await status({ 'Content-Type': 'audio/webm', 'Content-Length': '3' }, { person: false }),
    ).toBe(403);
    calls.upload.mockResolvedValueOnce({
      ok: false,
      status: 409,
      body: { error: 'already_uploaded' },
    });
    expect(await status({ 'Content-Type': 'audio/webm', 'Content-Length': '3' })).toBe(409);
  });
});

describe('playing', () => {
  it('reads one on this item, with its events', async () => {
    const res = await door({ path: ['w1'], level: 'view' });
    expect(await res.json()).toMatchObject({
      walkthrough: { id: 'w1', mine: false, canDelete: false },
      events: EVENTS,
    });
    calls.read.mockResolvedValueOnce({
      ok: true,
      value: { walkthrough: W, owner: 'me', events: EVENTS },
    });
    expect(await body(await door({ path: ['w1'], level: 'view' }))).toMatchObject({
      walkthrough: { mine: true, canDelete: true },
    });
    calls.read.mockResolvedValueOnce({
      ok: true,
      value: { walkthrough: { ...W, item: 'other' }, owner: 'me', events: EVENTS },
    });
    expect((await door({ path: ['w1'] })).status).toBe(404);
    calls.read.mockResolvedValueOnce(null);
    expect((await door({ path: ['w1'] })).status).toBe(404);
  });

  it('serves its media privately', async () => {
    const res = await door({ path: ['w1', 'media'], level: 'view' });
    expect(res.headers.get('Content-Type')).toBe('audio/webm');
    expect(res.headers.get('Content-Length')).toBe('3');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
    expect(calls.media).toHaveBeenCalledWith('w1', 'doc');
    calls.media.mockResolvedValueOnce({
      contentType: 'audio/webm',
      length: null,
      body: new Blob([]).stream(),
    });
    expect((await door({ path: ['w1', 'media'] })).headers.get('Content-Length')).toBeNull();
    calls.media.mockResolvedValueOnce(null);
    expect((await door({ path: ['w1', 'media'] })).status).toBe(404);
  });
});

describe('deleting', () => {
  it('lets an Editor delete any, and anyone else only their own', async () => {
    await door({ method: 'DELETE', path: ['w1'] });
    expect(calls.remove).toHaveBeenLastCalledWith('w1', { item: 'doc' });
    await door({ method: 'DELETE', path: ['w1'], level: 'view' });
    expect(calls.remove).toHaveBeenLastCalledWith('w1', { owner: 'me' });
    expect(
      (await door({ method: 'DELETE', path: ['w1'], level: 'view', owner: null })).status,
    ).toBe(403);
  });
});
