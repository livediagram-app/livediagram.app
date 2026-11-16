import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor } from '../test-media-service';
import { clearMediaOwnersForTests } from '../media';
import type { Env } from '../types';

// livediagram's walkthrough door (liveworkspace/docs/specs/006-media/walkthroughs.md "Each app's door";
// docs/specs/012-collaboration/walkthroughs.md "Share roles") over the real media service in this process: an Editor
// records, plays and deletes; a Viewer plays and deletes their own; a tab-scoped link, a Community visit and a canvas
// in the Trash see nothing; an API token never records. The index's grant is stood in for.

const { resolveDocumentGrant } = vi.hoisted(() => ({ resolveDocumentGrant: vi.fn() }));
vi.mock('./document-grant', () => ({ resolveDocumentGrant }));

import { handleWalkthroughs } from './walkthroughs';

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const EDIT = { level: 'edit', tab: null, shareCode: null, trashed: false };
const VIEW = { ...EDIT, level: 'view' };

const EVENTS = {
  v: 1,
  durationMs: 2000,
  camera: false,
  corner: 'bottom-left',
  startTab: 't1',
  hidden: ['secret'],
  fingerprints: { t1: 'f' },
  events: [
    { t: 0, k: 'point', id: 'secret' },
    { t: 10, k: 'point', id: 'e1' },
  ],
};

let db: SqliteD1;
beforeEach(() => {
  db = sqliteD1();
  mediaServiceFor(db.env);
  resolveDocumentGrant.mockReset();
  resolveDocumentGrant.mockResolvedValue(EDIT);
  clearMediaOwnersForTests();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Opts = { owner?: string | null; token?: { id: string }; env?: Env };
const call = (method: string, path: string, opts: Opts = {}, init?: RequestInit) => {
  const ctx = makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'user_ada' : opts.owner,
    env: opts.env ?? db.env,
    ...(opts.token ? { token: opts.token } : {}),
  });
  return handleWalkthroughs(
    init ? { ...ctx, request: new Request(`https://api.test${path}`, { method, ...init }) } : ctx,
  );
};

async function record(opts: Opts = {}) {
  const started = await call('POST', '/api/walkthroughs?d=doc', opts, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Tour',
      author: 'Ada',
      mediaType: 'audio/webm',
      mediaBytes: WEBM.byteLength,
      events: EVENTS,
    }),
  });
  expect(started.status).toBe(201);
  const { walkthrough } = (await started.json()) as { walkthrough: { id: string } };
  const put = await call('PUT', `/api/walkthroughs/${walkthrough.id}/media?d=doc`, opts, {
    headers: { 'Content-Type': 'audio/webm', 'Content-Length': String(WEBM.byteLength) },
    body: WEBM,
  });
  expect(put.status).toBe(200);
  return walkthrough.id;
}

describe('an Editor', () => {
  it('records one, sees it listed as theirs, plays it and deletes it', async () => {
    const empty = await call('GET', '/api/walkthroughs?d=doc');
    expect(await empty.json()).toEqual({ walkthroughs: [], canRecord: true });
    const id = await record();
    const listed = (await (await call('GET', '/api/walkthroughs?d=doc')).json()) as {
      walkthroughs: { id: string; mine: boolean; canDelete: boolean; title: string }[];
    };
    expect(listed.walkthroughs).toMatchObject([{ id, mine: true, canDelete: true, title: 'Tour' }]);
    const read = (await (await call('GET', `/api/walkthroughs/${id}?d=doc`)).json()) as {
      events: typeof EVENTS;
    };
    // The hidden element's press never reached storage.
    expect(read.events.events).toEqual([{ t: 10, k: 'point', id: 'e1' }]);
    const media = await call('GET', `/api/walkthroughs/${id}/media?d=doc`);
    expect(media.headers.get('Content-Type')).toBe('audio/webm');
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(WEBM);
    // Someone else's, as an Editor of the canvas.
    expect(
      (await call('DELETE', `/api/walkthroughs/${id}?d=doc`, { owner: 'user_bo' })).status,
    ).toBe(200);
    expect((await call('GET', `/api/walkthroughs/${id}?d=doc`)).status).toBe(404);
  });
});

describe('a Viewer', () => {
  it('plays, but neither records nor deletes another’s', async () => {
    const id = await record();
    resolveDocumentGrant.mockResolvedValue(VIEW);
    const listed = (await (
      await call('GET', '/api/walkthroughs?d=doc', { owner: 'user_bo' })
    ).json()) as {
      walkthroughs: { mine: boolean; canDelete: boolean }[];
      canRecord: boolean;
    };
    expect(listed).toMatchObject({
      canRecord: false,
      walkthroughs: [{ mine: false, canDelete: false }],
    });
    expect(
      (await call('POST', '/api/walkthroughs?d=doc', { owner: 'user_bo' }, { body: '{}' })).status,
    ).toBe(403);
    expect(
      (await call('DELETE', `/api/walkthroughs/${id}?d=doc`, { owner: 'user_bo' })).status,
    ).toBe(403);
    // Their own, recorded while they were an Editor, they may.
    expect((await call('DELETE', `/api/walkthroughs/${id}?d=doc`)).status).toBe(200);
  });
});

describe('closed visits', () => {
  it('shows nothing through a tab-scoped link, in the Trash, or without a grant', async () => {
    resolveDocumentGrant.mockResolvedValue({ ...VIEW, tab: 't1' });
    expect((await call('GET', '/api/walkthroughs?d=doc')).status).toBe(404);
    resolveDocumentGrant.mockResolvedValue({ ...EDIT, trashed: true });
    expect((await call('GET', '/api/walkthroughs?d=doc')).status).toBe(404);
    resolveDocumentGrant.mockResolvedValue(null);
    expect((await call('GET', '/api/walkthroughs?d=doc')).status).toBe(404);
    resolveDocumentGrant.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await call('GET', '/api/walkthroughs?d=doc')).status).toBe(401);
  });

  it("shows nothing through the canvas's Community post's link, but does through another link", async () => {
    const env = {
      ...db.env,
      DOCUMENT_ROOM: {
        idFromName: (name: string) => name,
        get: () => ({ community: async () => ({ code: 'POST', open: true }) }),
      },
    } as unknown as Env;
    resolveDocumentGrant.mockResolvedValue({ ...VIEW, shareCode: 'POST' });
    expect((await call('GET', '/api/walkthroughs?d=doc', { owner: null, env })).status).toBe(404);
    resolveDocumentGrant.mockResolvedValue({ ...VIEW, shareCode: 'OTHER' });
    expect((await call('GET', '/api/walkthroughs?d=doc', { owner: null, env })).status).toBe(200);
  });

  it('never lets an API token record, and answers other verbs as missing', async () => {
    const listed = await call('GET', '/api/walkthroughs?d=doc', { token: { id: 't' } });
    expect(await listed.json()).toMatchObject({ canRecord: false });
    expect((await call('PATCH', '/api/walkthroughs?d=doc')).status).toBe(404);
    expect((await call('GET', '/api/walkthroughs/a/media/extra?d=doc')).status).toBe(404);
  });
});
