// The sweep (liveworkspace/docs/specs/007-community/community.md "The sweep") and an account's posts going with it:
// each app's posts checked longest ago are asked of the app's door with the app's key, and removed, kept or re-stated
// as the index answers; an app that does not answer changes nothing; the cron is bounded per app and run.
import {
  COMMUNITY_STATES_DOOR,
  COMMUNITY_SWEEP_BATCH,
  type CommunityApp,
  type CommunityAppPublish,
} from '@liveworkspace/community';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_SWEEP_EVERY_MS } from './config';
import { appOrigin } from './env';
import worker from './index';
import { createPost } from './posts';
import { claimSweepBatch, sweepApp, sweepCommunity } from './sweep';
import { testDb, type TestDb } from './test-sqlite-d1';

const LD: CommunityApp = 'livediagram.app';
const NOW = 100 * COMMUNITY_SWEEP_EVERY_MS;
const ORIGINS = {
  APP_ORIGIN_LIVEDIAGRAM: 'https://www.livediagram.app/',
  APP_ORIGIN_LIVEPLANNER: 'https://www.liveplanner.app',
};

let db: TestDb;
type Asked = {
  url: string;
  auth: string | null;
  posts: { id: string; code: string; owner: string }[];
};
let asked: Asked[];
let answer: (posts: Asked['posts']) => Response | Promise<Response>;

beforeEach(() => {
  db = testDb(ORIGINS);
  asked = [];
  answer = (posts) => Response.json({ states: posts.map((p) => ({ id: p.id, state: 'public' })) });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const posts = (JSON.parse(String(init.body)) as { posts: Asked['posts'] }).posts;
    asked.push({ url: String(input), auth: new Headers(init.headers).get('Authorization'), posts });
    return answer(posts);
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const publishing = (owner = 'user_author', document = 'd1'): CommunityAppPublish => ({
  owner,
  shareCode: `CODE${document}`,
  documentState: 'public',
  author: { name: 'Ada', color: '#f97316', picture: null },
  input: {
    title: 'Payments platform',
    description: 'How our payment services talk to each other.',
    category: 'software',
    tags: [],
    anonymous: false,
  },
});

async function publish(document: string, app: CommunityApp = LD, owner = 'user_author') {
  const id = await createPost(db.env, app, document, publishing(owner, document), 1000);
  if (!id) throw new Error('post_limit');
  return id;
}

const states =
  (...pairs: [string, string][]) =>
  (posts: Asked['posts']) =>
    Response.json({
      states: posts.map((p) => ({
        id: p.id,
        state: pairs.find(([d]) => d === p.id)?.[1] ?? 'public',
      })),
    });

const rows = () =>
  db.sql
    .prepare('SELECT document, document_state, state, checked_at FROM posts ORDER BY document')
    .all();

describe('the sweep', () => {
  it("asks the app's door with the app's key, each post's document, link and owner", async () => {
    await publish('d1');
    await sweepApp(db.env, LD, NOW);
    expect(asked).toEqual([
      {
        url: `https://www.livediagram.app${COMMUNITY_STATES_DOOR}`,
        auth: 'Bearer ld-key',
        posts: [{ id: 'd1', code: 'CODEd1', owner: 'user_author' }],
      },
    ]);
  });

  it('removes the posts of documents gone (deleted for good, archived, a closed account) and away (the Trash)', async () => {
    for (const d of ['d1', 'd2', 'd3', 'd4']) await publish(d);
    answer = states(['d1', 'gone'], ['d2', 'away'], ['d3', 'closed']);
    expect(await sweepApp(db.env, LD, NOW)).toBe(3);
    expect(rows()).toEqual([
      { document: 'd3', document_state: 'closed', state: 'listed', checked_at: NOW },
      { document: 'd4', document_state: 'public', state: 'listed', checked_at: NOW },
    ]);
  });

  it('keeps a hidden post whose document is in the Trash, away, and lists a closed one again once public', async () => {
    const hidden = await publish('d1');
    await publish('d2');
    db.sql.prepare("UPDATE posts SET state = 'hidden' WHERE id = ?").run(hidden);
    db.sql.prepare("UPDATE posts SET document_state = 'closed' WHERE document = 'd2'").run();
    answer = states(['d1', 'away']);
    await sweepApp(db.env, LD, NOW);
    expect(rows()).toEqual([
      { document: 'd1', document_state: 'away', state: 'hidden', checked_at: NOW },
      { document: 'd2', document_state: 'public', state: 'listed', checked_at: NOW },
    ]);
  });

  it('removes a listed post the migration left away (no room ever told the service)', async () => {
    await publish('d1');
    db.sql.prepare("UPDATE posts SET document_state = 'away'").run();
    answer = states(['d1', 'away']);
    expect(await sweepApp(db.env, LD, NOW)).toBe(1);
    expect(rows()).toEqual([]);
  });

  it('changes nothing and writes no state for an unchanged answer, but stamps the batch', async () => {
    await publish('d1');
    expect(await sweepApp(db.env, LD, NOW)).toBe(0);
    expect(rows()).toEqual([
      { document: 'd1', document_state: 'public', state: 'listed', checked_at: NOW },
    ]);
  });

  it('checks a post again only once its last check is old enough, the oldest first, a batch at a time', async () => {
    // Spread over owners: each may have at most 50 posts in an app.
    for (let i = 0; i < COMMUNITY_SWEEP_BATCH + 3; i++) await publish(`d${i}`, LD, `user_${i % 5}`);
    db.sql.prepare("UPDATE posts SET checked_at = 7 WHERE document = 'd0'").run();
    db.sql.prepare("UPDATE posts SET checked_at = 3 WHERE document = 'd1'").run();
    // Never more than a batch a run, never one checked more recently ahead of one checked earlier.
    await sweepApp(db.env, LD, NOW);
    expect(asked[0]!.posts).toHaveLength(COMMUNITY_SWEEP_BATCH);
    expect(asked[0]!.posts.map((p) => p.id)).not.toContain('d0');
    const rest = await claimSweepBatch(db.env, LD, NOW);
    expect(rest.map((r) => r.document).slice(-2)).toEqual(['d1', 'd0']);
    expect(rest).toHaveLength(3);
    await sweepApp(db.env, LD, NOW);
    // Just checked: nothing due until COMMUNITY_SWEEP_EVERY_MS has passed.
    expect(await claimSweepBatch(db.env, LD, NOW + COMMUNITY_SWEEP_EVERY_MS - 1)).toEqual([]);
    expect(await claimSweepBatch(db.env, LD, NOW + COMMUNITY_SWEEP_EVERY_MS + 1)).toHaveLength(
      COMMUNITY_SWEEP_BATCH,
    );
  });

  it('changes nothing for an app that does not answer, or answers something malformed', async () => {
    await publish('d1');
    for (const failure of [
      () => new Response('down', { status: 503 }),
      () => new Response('not json', { status: 200 }),
      () => Response.json({ states: 'no' }),
      () => {
        throw new Error('unreachable');
      },
    ]) {
      answer = failure;
      expect(await sweepApp(db.env, LD, NOW)).toBe(0);
      expect(rows()).toEqual([
        { document: 'd1', document_state: 'public', state: 'listed', checked_at: 0 },
      ]);
    }
    // An answer naming an unknown state or document is ignored for that post alone.
    answer = () =>
      Response.json({
        states: [{ id: 'd1', state: 'deleted' }, { id: 'other', state: 'gone' }, null],
      });
    expect(await sweepApp(db.env, LD, NOW)).toBe(0);
    expect(rows()).toEqual([
      { document: 'd1', document_state: 'public', state: 'listed', checked_at: NOW },
    ]);
  });

  it('skips an app without a key or an origin, and one failing app never stops the others', async () => {
    await publish('d1');
    await publish('p1', 'liveplanner.app');
    await publish('c1', 'livedocuments.app');
    answer = states(['d1', 'gone'], ['p1', 'gone']);
    // livedocuments has a key but no origin: not asked.
    await sweepCommunity(db.env, NOW);
    expect(asked.map((a) => a.url)).toEqual([
      `https://www.livediagram.app${COMMUNITY_STATES_DOOR}`,
      `https://www.liveplanner.app${COMMUNITY_STATES_DOOR}`,
    ]);
    expect(rows().map((r) => (r as { document: string }).document)).toEqual(['c1']);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = testDb({
      ...ORIGINS,
      APP_ORIGIN_LIVEDOCUMENTS: 'https://www.livedocuments.app',
    });
    const prepare = broken.env.COMMUNITY_DB.prepare.bind(broken.env.COMMUNITY_DB);
    let calls = 0;
    broken.env.COMMUNITY_DB.prepare = ((query: string) => {
      if (calls++ === 0) throw new Error('d1 down');
      return prepare(query);
    }) as D1Database['prepare'];
    await expect(sweepCommunity(broken.env, NOW)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('[community] sweep failed', expect.anything());
  });

  it('runs from the cron, and not at all while the Community is off', async () => {
    await publish('d1');
    answer = states(['d1', 'gone']);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    } as unknown as ExecutionContext;
    worker.scheduled({} as ScheduledController, { ...db.env, COMMUNITY_ENABLED: 'off' }, ctx);
    expect(waits).toHaveLength(0);
    worker.scheduled({} as ScheduledController, db.env, ctx);
    await Promise.all(waits);
    expect(rows()).toEqual([]);
  });

  it('reads an origin without its trailing slash, and none when blank', () => {
    expect(appOrigin(db.env, LD)).toBe('https://www.livediagram.app');
    expect(appOrigin({ ...db.env, APP_ORIGIN_LIVEDIAGRAM: '  ' }, LD)).toBeUndefined();
  });
});

describe('an account closed', () => {
  const forget = (payload: unknown) =>
    worker.fetch(
      new Request('https://liveworkspace.app/api/community/app/copiers/forget', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ld-key',
          'X-Community-App': LD,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      db.env,
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    );

  it("removes every post the account made in the app, hidden ones too, and no one else's", async () => {
    const hidden = await publish('d1', LD, 'user_gone');
    await publish('d2', LD, 'user_gone');
    await publish('d3', LD, 'user_kept');
    await publish('p1', 'liveplanner.app', 'user_gone');
    db.sql.prepare("UPDATE posts SET state = 'hidden' WHERE id = ?").run(hidden);
    expect((await forget({ copier: 'hash', owner: 'user_gone' })).status).toBe(204);
    expect(rows().map((r) => (r as { document: string }).document)).toEqual(['d3', 'p1']);
  });

  it('keeps the posts when only the copier is named, and refuses a malformed owner', async () => {
    await publish('d1', LD, 'user_gone');
    expect((await forget({ copier: 'hash' })).status).toBe(204);
    expect((await forget({ copier: 'hash', owner: '' })).status).toBe(400);
    expect(rows()).toHaveLength(1);
  });
});
