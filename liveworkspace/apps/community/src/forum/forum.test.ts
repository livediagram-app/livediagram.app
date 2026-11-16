// The Forum over HTTP (liveworkspace/docs/specs/007-community/community.md "The Forum", "Forum routes"): anyone reads;
// only a signed-in account posts, replies, reacts and marks an answer; every post and edit is checked before anyone
// else sees it, and waits as Pending when the check can't answer; reports hide as a gallery post's do; each account's
// writes are counted; authors edit and delete their own; a closed account's Forum goes with it.
import {
  FORUM_PAGE_SIZE,
  FORUM_REPLIES_MAX,
  FORUM_WRITES_PER_HOUR,
  type ForumReactions,
  type ForumReply,
  type ForumTopic,
  type ForumTopicResponse,
  type ForumTopicsResponse,
} from '@liveworkspace/community';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import worker from '../index';
import { FORUM_CHECK_MODEL, FORUM_CHECKS_PER_DAY, FORUM_RETRY_EVERY_MS } from '../config';
import type { Env, ForumAi } from '../env';
import { testDb, type TestDb } from '../test-sqlite-d1';
import { checkForumText, readVerdict, retryForumChecks } from './check';
import { bearerOf } from './account';
import { DAY_MS } from './rate';
import { getForumPost, settleCheck } from './store';

const ctx = {
  waitUntil: (p: Promise<unknown>) => void waits.push(p),
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
let waits: Promise<unknown>[] = [];

const BASE = 'https://liveworkspace.app/api/community/forum';
const ACCOUNTS = 'https://accounts.test';
const AUDIENCE = 'https://livediagram.app/api';
const KEYS = [
  '0b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f',
  '1b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f',
  '2b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f',
];

let signer: CryptoKey;
let jwk: JWK;
let stranger: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  signer = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'acc1', alg: 'EdDSA' };
  stranger = (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey;
});

function token(sub: string, claims: Record<string, unknown> = {}, key = signer): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'acc1' })
    .setIssuer(`${ACCOUNTS}/api/auth`)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

const safe = (): ForumAi => ({ run: vi.fn(async () => ({ response: { safe: true } })) });
const unsafe = (): ForumAi => ({
  run: vi.fn(async () => ({ response: { safe: false, categories: ['S10'] } })),
});
const broken = (): ForumAi => ({
  run: vi.fn(async () => {
    throw new Error('3040: capacity');
  }),
});

let db: TestDb;
let env: Env;
let ada: string;
let bea: string;
let cal: string;

beforeEach(async () => {
  waits = [];
  db = testDb({
    ENVIRONMENT: 'production',
    ACCOUNTS_URL: ACCOUNTS,
    INDEX_AUDIENCES: AUDIENCE,
    ACCOUNTS: { fetch: async () => Response.json({ keys: [jwk] }) },
    AI: safe(),
  });
  env = db.env;
  [ada, bea, cal] = await Promise.all([token('user_ada'), token('user_bea'), token('user_cal')]);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const call = (path: string, init: RequestInit = {}, on: Env = env) =>
  worker.fetch(new Request(`${BASE}${path}`, init), on, ctx);

function as(bearer: string | null, init: RequestInit = {}, value?: unknown): RequestInit {
  return {
    ...init,
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.livediagram.app',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...init.headers,
    },
  };
}

const AUTHOR = { name: 'Ada', color: '#F97316' };
const QUESTION = {
  category: 'livediagram',
  title: 'How do I  export a diagram?',
  body: 'I want a PNG of the whole canvas.\r\n\r\n\r\n\r\nIs there a way?',
  author: AUTHOR,
};

async function ask(bearer = ada, patch: Record<string, unknown> = {}, on: Env = env) {
  const res = await call('/topics', as(bearer, { method: 'POST' }, { ...QUESTION, ...patch }), on);
  return {
    res,
    topic: res.status === 201 ? ((await res.json()) as { topic: ForumTopic }).topic : null,
  };
}

async function reply(topicId: string, bearer = bea, text = 'Use Export, then PNG.') {
  const res = await call(
    `/topics/${topicId}/replies`,
    as(bearer, { method: 'POST' }, { body: text, author: { name: 'Bea', color: '#2563eb' } }),
  );
  return {
    res,
    reply: res.status === 201 ? ((await res.json()) as { reply: ForumReply }).reply : null,
  };
}

async function list(query = '', bearer: string | null = null) {
  const res = await call(`/topics${query}`, as(bearer));
  return { res, body: (await res.json()) as ForumTopicsResponse };
}

async function read(id: string, bearer: string | null = null) {
  const res = await call(`/topics/${id}`, as(bearer));
  return { res, body: res.ok ? ((await res.json()) as ForumTopicResponse) : null };
}

const fromBrowser = (key: string, ip: string): RequestInit => ({
  method: 'POST',
  body: JSON.stringify({ reason: 'spam' }),
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://www.livediagram.app',
    'X-Community-Key': key,
    'CF-Connecting-IP': ip,
  },
});

async function reportThrice(id: string) {
  for (const [i, key] of KEYS.entries()) {
    expect((await call(`/posts/${id}/report`, fromBrowser(key, `${i + 1}.1.1.1`))).status).toBe(
      204,
    );
  }
}

describe('reading', () => {
  it('is open to anyone, cacheable without a token and private with one', async () => {
    await ask();
    const anonymous = await list();
    expect(anonymous.res.status).toBe(200);
    expect(anonymous.res.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(anonymous.res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(anonymous.body.topics).toHaveLength(1);
    expect(anonymous.body.topics[0]).toMatchObject({ own: false, replyCount: 0, answered: false });
    const signedIn = await list('', ada);
    expect(signedIn.res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(signedIn.body.topics[0]!.own).toBe(true);
  });

  it('never answers an account id', async () => {
    const { topic } = await ask();
    await reply(topic!.id);
    const page = JSON.stringify((await read(topic!.id)).body) + JSON.stringify((await list()).body);
    expect(page).not.toContain('user_ada');
    expect(page).not.toContain('user_bea');
  });

  it('pages 20 at a time, by category and sort', async () => {
    const now = Date.now();
    for (let i = 0; i < FORUM_PAGE_SIZE + 1; i++) {
      db.sql
        .prepare(
          `INSERT INTO forum_posts (id, category, author_id, author_name, author_color, title, body, state, created_at, activity_at)
           VALUES (?, ?, 'user_x', 'X', '#000000', ?, 'A body long enough', 'listed', ?, ?)`,
        )
        .run(`t${i}`, i % 2 ? 'general' : 'liveplanner', `Topic ${i}`, now + i, now - i);
    }
    const first = await list();
    expect(first.body.topics).toHaveLength(FORUM_PAGE_SIZE);
    // Latest activity first: t0 was active last.
    expect(first.body.topics[0]!.id).toBe('t0');
    expect(first.body.nextOffset).toBe(FORUM_PAGE_SIZE);
    const rest = await list(`?offset=${FORUM_PAGE_SIZE}`);
    expect(rest.body.topics).toHaveLength(1);
    expect(rest.body.nextOffset).toBeNull();
    expect((await list('?sort=new')).body.topics[0]!.id).toBe(`t${FORUM_PAGE_SIZE}`);
    const general = await list('?category=general');
    expect(general.body.topics.every((t) => t.category === 'general')).toBe(true);
    // An unknown category reads as every category, an unknown sort as Latest Activity.
    expect((await list('?category=nope&sort=nope')).body.topics[0]!.id).toBe('t0');
  });

  it('answers 404 for a missing topic, a reply read as a topic, and an unknown route', async () => {
    const { topic } = await ask();
    const { reply: r } = await reply(topic!.id);
    expect((await read('missing')).res.status).toBe(404);
    expect((await read(r!.id)).res.status).toBe(404);
    expect((await call('/nowhere')).status).toBe(404);
    expect((await call('/topics', { method: 'DELETE' })).status).toBe(404);
    expect((await call(`/posts/${r!.id}`, as(ada, { method: 'GET' }))).status).toBe(404);
    expect((await call(`/topics/${topic!.id}/answer`, as(ada, { method: 'POST' }))).status).toBe(
      404,
    );
    expect(
      (await call(`/posts/${r!.id}/reactions/helpful`, as(ada, { method: 'POST' }))).status,
    ).toBe(404);
  });

  it('answers nothing while the Community is switched off', async () => {
    const off = { ...env, COMMUNITY_ENABLED: 'off' };
    expect((await call('/topics', {}, off)).status).toBe(404);
  });
});

describe('who may write', () => {
  it('refuses a write with no token, a guest token, a forged one or another audience', async () => {
    const guest = await token('guest_1234', { kind: 'guest' });
    const forged = await token('user_ada', {}, stranger);
    for (const bearer of [null, guest, forged, 'not-a-jwt']) {
      const { res } = await ask(bearer as string);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'sign_in_required' });
    }
    // Without the audiences configured nobody can be checked, so nobody writes.
    const { res } = await ask(ada, {}, { ...env, INDEX_AUDIENCES: ' ' });
    expect(res.status).toBe(401);
    expect((await list()).body.topics).toEqual([]);
  });

  it('refuses every other write signed out', async () => {
    const { topic } = await ask();
    const signedOut = [
      call(`/topics/${topic!.id}/replies`, as(null, { method: 'POST' }, { body: 'Hi there' })),
      call(`/topics/${topic!.id}/answer`, as(null, { method: 'PUT' }, { reply: 'x' })),
      call(`/posts/${topic!.id}`, as(null, { method: 'PATCH' }, { body: 'New words here' })),
      call(`/posts/${topic!.id}`, as(null, { method: 'DELETE' })),
      call(`/posts/${topic!.id}/reactions/helpful`, as(null, { method: 'PUT' })),
    ];
    for (const res of await Promise.all(signedOut)) expect(res.status).toBe(401);
  });

  it('reads the bearer from its header, nothing else', () => {
    const req = (value: string) => new Request(BASE, { headers: { Authorization: value } });
    expect(bearerOf(req('Bearer abc'))).toBe('abc');
    expect(bearerOf(req('bearer  abc '))).toBe('abc');
    expect(bearerOf(req('Basic abc'))).toBeNull();
    expect(bearerOf(req('Bearer'))).toBeNull();
    expect(bearerOf(req('Bearer a b'))).toBeNull();
    expect(bearerOf(new Request(BASE))).toBeNull();
  });

  it('lets a page on an app address send them', async () => {
    const res = await call('/topics', {
      method: 'OPTIONS',
      headers: { Origin: 'https://www.liveplanner.app', 'Access-Control-Request-Method': 'PATCH' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://www.liveplanner.app');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    const elsewhere = await call(
      '/topics',
      as(ada, { method: 'POST', headers: { Origin: 'https://evil.test' } }, QUESTION),
    );
    expect(elsewhere.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('a new topic', () => {
  it('is checked, then listed, with its text tidied and its author as the account shows', async () => {
    const { res, topic } = await ask();
    expect(res.status).toBe(201);
    expect(topic).toMatchObject({
      title: 'How do I export a diagram?',
      body: 'I want a PNG of the whole canvas.\n\nIs there a way?',
      author: { name: 'Ada', color: '#f97316' },
      state: 'listed',
      own: true,
      answerId: null,
      category: 'livediagram',
    });
    const run = (env.AI as { run: ReturnType<typeof vi.fn> }).run;
    expect(run).toHaveBeenCalledWith(FORUM_CHECK_MODEL, {
      messages: [{ role: 'user', content: expect.stringContaining('Name: Ada') }],
    });
  });

  it('picks a colour from the account when the page sends none', async () => {
    const { topic } = await ask(ada, { author: { name: 'Ada' } });
    expect(topic!.author.color).toMatch(/^#[0-9a-f]{6}$/);
    expect((await ask(ada, { author: { name: 'Ada', color: 'red' } })).topic!.author.color).toBe(
      topic!.author.color,
    );
  });

  it('names the first field that fails', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ category: 'diagrams' }, 'invalid_category'],
      [{ title: 'Hey' }, 'invalid_title'],
      [{ title: 'x'.repeat(121) }, 'invalid_title'],
      [{ body: 'short' }, 'invalid_body'],
      [{ body: 'x'.repeat(5001) }, 'invalid_body'],
      [{ author: { name: '  ' } }, 'invalid_author'],
      [{ author: null }, 'invalid_author'],
    ];
    for (const [patch, error] of cases) {
      const { res } = await ask(ada, patch);
      expect(res.status, error).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    for (const raw of ['not json', 'null', '[1]']) {
      const res = await call('/topics', { ...as(ada, { method: 'POST' }), body: raw });
      expect(await res.json()).toEqual({ error: 'invalid_body' });
    }
    expect((env.AI as { run: ReturnType<typeof vi.fn> }).run).not.toHaveBeenCalled();
  });

  it('is refused when the check fails: its author sees it, nobody else does', async () => {
    const { topic } = await ask(ada, {}, { ...env, AI: unsafe() });
    expect(topic!.state).toBe('refused');
    expect((await list()).body.topics).toEqual([]);
    expect((await read(topic!.id)).res.status).toBe(404);
    expect((await read(topic!.id, bea)).res.status).toBe(404);
    const own = await list('', ada);
    expect(own.body.topics).toMatchObject([{ id: topic!.id, state: 'refused', own: true }]);
    expect((await read(topic!.id, ada)).body!.topic.state).toBe('refused');
    // Not on a later page, nor in another category.
    expect((await list('?offset=20', ada)).body.topics).toEqual([]);
    expect((await list('?category=general', ada)).body.topics).toEqual([]);
  });

  it('waits as Pending without the binding, and the cron lists it once the check answers', async () => {
    const noAi = { ...env, AI: undefined };
    const { topic } = await ask(ada, {}, noAi);
    expect(topic!.state).toBe('pending');
    expect((await list()).body.topics).toEqual([]);
    // Without the binding the cron has nothing to ask.
    await retryForumChecks(noAi, Date.now() + FORUM_RETRY_EVERY_MS);
    expect((await getForumPost(env, topic!.id))!.state).toBe('pending');
    await retryForumChecks(env, Date.now() + FORUM_RETRY_EVERY_MS);
    expect((await getForumPost(env, topic!.id))!.state).toBe('listed');
    expect((await list()).body.topics).toHaveLength(1);
  });

  it('waits when the model errs, is slow or answers nonsense, and is asked again', async () => {
    const { topic } = await ask(ada, {}, { ...env, AI: broken() });
    expect(topic!.state).toBe('pending');
    const later = Date.now() + FORUM_RETRY_EVERY_MS;
    await retryForumChecks({ ...env, AI: { run: async () => 'maybe' } }, later);
    const row = (await getForumPost(env, topic!.id))!;
    expect(row).toMatchObject({ state: 'pending', check_tries: 2, checked_at: later });
    // Not due again until the interval has passed.
    const run = vi.fn(async () => ({ response: { safe: false } }));
    await retryForumChecks({ ...env, AI: { run } }, later + 1);
    expect(run).not.toHaveBeenCalled();
    await retryForumChecks({ ...env, AI: { run } }, later + FORUM_RETRY_EVERY_MS);
    expect((await getForumPost(env, topic!.id))!.state).toBe('refused');
  });

  it('gives up on a slow check after ten seconds', async () => {
    vi.useFakeTimers();
    const slow: ForumAi = { run: () => new Promise(() => {}) };
    const verdict = checkForumText({ ...env, AI: slow }, 'text', Date.now());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await verdict).toBe('unavailable');
  });

  it('stops asking past the day’s cap, so the allowance is never run past', async () => {
    const now = Date.now();
    db.sql
      .prepare('INSERT INTO forum_counters (subject, bucket, n) VALUES (?, ?, ?)')
      .run('checks', Math.floor(now / DAY_MS) * DAY_MS, FORUM_CHECKS_PER_DAY);
    expect(await checkForumText(env, 'text', now)).toBe('unavailable');
    expect((env.AI as { run: ReturnType<typeof vi.fn> }).run).not.toHaveBeenCalled();
    // The next day counts afresh.
    expect(await checkForumText(env, 'text', now + DAY_MS)).toBe('pass');
  });

  it('lists without asking only in development with the local pass', async () => {
    const local = { ...env, AI: undefined, FORUM_CHECK_LOCAL: 'pass' };
    expect((await ask(ada, {}, { ...local, ENVIRONMENT: 'development' })).topic!.state).toBe(
      'listed',
    );
    expect((await ask(ada, {}, local)).topic!.state).toBe('pending');
    await retryForumChecks(
      { ...local, ENVIRONMENT: 'development' },
      Date.now() + FORUM_RETRY_EVERY_MS,
    );
    expect((await list()).body.topics).toHaveLength(2);
  });

  it('counts each account’s writes by the hour', async () => {
    const now = Date.now();
    db.sql
      .prepare('INSERT INTO forum_counters (subject, bucket, n) VALUES (?, ?, ?)')
      .run('w:user_ada', Math.floor(now / 3_600_000) * 3_600_000, FORUM_WRITES_PER_HOUR - 1);
    expect((await ask()).res.status).toBe(201);
    const { res } = await ask();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
    // Someone else is not held up.
    expect((await ask(bea)).res.status).toBe(201);
  });
});

describe('replies and the answer', () => {
  it('answers a listed topic, one level, moving it up the list', async () => {
    const clock = vi.spyOn(Date, 'now');
    const start = Date.now();
    clock.mockReturnValue(start);
    const { topic: older } = await ask();
    clock.mockReturnValue(start + 1000);
    const { topic: newer } = await ask(ada, { title: 'A second question' });
    expect((await list()).body.topics[0]!.id).toBe(newer!.id);
    clock.mockReturnValue(start + 60_000);
    const { res, reply: r } = await reply(older!.id);
    expect(res.status).toBe(201);
    expect(r).toMatchObject({ topicId: older!.id, state: 'listed', own: true });
    const page = await list();
    expect(page.body.topics[0]).toMatchObject({ id: older!.id, replyCount: 1 });
    // Replies are one level: a reply is not a topic to reply to.
    expect((await reply(r!.id)).res.status).toBe(404);
  });

  it('refuses a reply to a topic nobody else can see, a bad body, or a full topic', async () => {
    const { topic: waiting } = await ask(ada, {}, { ...env, AI: undefined });
    expect((await reply(waiting!.id, ada)).res.status).toBe(404);
    const { topic } = await ask();
    const bad = await call(
      `/topics/${topic!.id}/replies`,
      as(bea, { method: 'POST' }, { body: 'x', author: AUTHOR }),
    );
    expect(await bad.json()).toEqual({ error: 'invalid_body' });
    const noName = await call(
      `/topics/${topic!.id}/replies`,
      as(bea, { method: 'POST' }, { body: 'Hello there' }),
    );
    expect(await noName.json()).toEqual({ error: 'invalid_author' });
    const empty = await call(`/topics/${topic!.id}/replies`, {
      ...as(bea, { method: 'POST' }),
      body: 'nope',
    });
    expect(await empty.json()).toEqual({ error: 'invalid_body' });
    const insert = db.sql.prepare(
      `INSERT INTO forum_posts (id, topic_id, category, author_id, author_name, author_color, body, state, created_at, activity_at)
       VALUES (?, ?, 'livediagram', 'user_x', 'X', '#000000', 'Reply', 'listed', 1, 1)`,
    );
    for (let i = 0; i < FORUM_REPLIES_MAX; i++) insert.run(`r${i}`, topic!.id);
    const full = await reply(topic!.id);
    expect(full.res.status).toBe(409);
    expect(await full.res.json()).toEqual({ error: 'topic_full' });
  });

  it('shows a waiting reply to its author alone, and lists it once checked', async () => {
    const { topic } = await ask();
    const res = await call(
      `/topics/${topic!.id}/replies`,
      as(bea, { method: 'POST' }, { body: 'Try this one.', author: { name: 'Bea' } }),
      { ...env, AI: undefined },
    );
    const waiting = ((await res.json()) as { reply: ForumReply }).reply;
    expect(waiting.state).toBe('pending');
    expect((await read(topic!.id)).body!.replies).toEqual([]);
    expect((await read(topic!.id, bea)).body!.replies.map((r) => r.state)).toEqual(['pending']);
    expect((await list()).body.topics[0]!.replyCount).toBe(0);
    await retryForumChecks(env, Date.now() + FORUM_RETRY_EVERY_MS);
    expect((await read(topic!.id)).body!.replies.map((r) => r.id)).toEqual([waiting.id]);
  });

  it('is marked by the topic’s author only, shown first, and cleared when the answer goes', async () => {
    const { topic } = await ask();
    const { reply: first } = await reply(topic!.id, bea, 'First reply here');
    const { reply: second } = await reply(topic!.id, cal, 'Second reply here');
    const mark = (bearer: string, value: unknown) =>
      call(`/topics/${topic!.id}/answer`, as(bearer, { method: 'PUT' }, value));
    expect((await mark(bea, { reply: second!.id })).status).toBe(404);
    expect(await (await mark(ada, {})).json()).toEqual({ error: 'invalid_reply' });
    expect((await mark(ada, { reply: topic!.id })).status).toBe(404);
    expect(await (await mark(ada, { reply: second!.id })).json()).toEqual({ answerId: second!.id });

    const page = (await read(topic!.id)).body!;
    expect(page.topic.answerId).toBe(second!.id);
    expect(page.replies.map((r) => r.id)).toEqual([second!.id, first!.id]);
    expect((await list()).body.topics[0]!.answered).toBe(true);
    expect((await list('?sort=unanswered')).body.topics).toEqual([]);

    const cleared = await call(`/topics/${topic!.id}/answer`, as(ada, { method: 'DELETE' }));
    expect(await cleared.json()).toEqual({ answerId: null });
    expect((await list('?sort=unanswered')).body.topics).toHaveLength(1);

    await mark(ada, { reply: first!.id });
    expect((await call(`/posts/${first!.id}`, as(bea, { method: 'DELETE' }))).status).toBe(204);
    expect((await read(topic!.id)).body!.topic.answerId).toBeNull();
    expect((await list()).body.topics[0]).toMatchObject({ answered: false, replyCount: 1 });
  });
});

describe('reactions', () => {
  it('counts one of each per account, marks the reader’s own, and takes them back', async () => {
    const { topic } = await ask();
    const react = async (bearer: string, kind: string, method = 'PUT') => {
      const res = await call(`/posts/${topic!.id}/reactions/${kind}`, as(bearer, { method }));
      return {
        res,
        reactions: res.ok ? ((await res.json()) as { reactions: ForumReactions }).reactions : null,
      };
    };
    await react(bea, 'helpful');
    await react(bea, 'helpful');
    await react(cal, 'helpful');
    const mine = await react(bea, 'celebrate');
    expect(mine.reactions).toEqual({
      counts: { helpful: 2, thanks: 0, celebrate: 1 },
      mine: ['helpful', 'celebrate'],
    });
    expect((await read(topic!.id, cal)).body!.topic.reactions).toEqual({
      counts: { helpful: 2, thanks: 0, celebrate: 1 },
      mine: ['helpful'],
    });
    expect((await read(topic!.id)).body!.topic.reactions.mine).toEqual([]);
    const back = await react(bea, 'helpful', 'DELETE');
    expect(back.reactions!.counts.helpful).toBe(1);
    const gone = await react(bea, 'celebrate', 'DELETE');
    expect(gone.reactions!.mine).toEqual([]);
    expect((await react(bea, 'love')).res.status).toBe(404);
    const { topic: waiting } = await ask(ada, {}, { ...env, AI: undefined });
    expect(
      (await call(`/posts/${waiting!.id}/reactions/helpful`, as(ada, { method: 'PUT' }))).status,
    ).toBe(404);
    const last = await react(cal, 'helpful', 'DELETE');
    expect(last.reactions).toEqual({ counts: { helpful: 0, thanks: 0, celebrate: 0 }, mine: [] });
  });

  it('counts each account’s reactions by the hour', async () => {
    const { topic } = await ask();
    const now = Date.now();
    db.sql
      .prepare('INSERT INTO forum_counters (subject, bucket, n) VALUES (?, ?, ?)')
      .run('r:user_bea', Math.floor(now / 3_600_000) * 3_600_000, 200);
    expect(
      (await call(`/posts/${topic!.id}/reactions/thanks`, as(bea, { method: 'PUT' }))).status,
    ).toBe(429);
  });
});

describe('editing and deleting', () => {
  it('lets its author edit, checking the new words again', async () => {
    const { topic } = await ask();
    const patch = (bearer: string, value: unknown, on: Env = env) =>
      call(`/posts/${topic!.id}`, as(bearer, { method: 'PATCH' }, value), on);
    expect(
      (await patch(bea, { title: 'Hijacked title', body: 'Someone else words', author: AUTHOR }))
        .status,
    ).toBe(404);
    expect(
      await (await patch(ada, { title: 'Hm', body: 'Long enough body', author: AUTHOR })).json(),
    ).toEqual({
      error: 'invalid_title',
    });
    const res = await patch(ada, {
      title: 'Exporting a diagram as PNG',
      body: 'Edited question body',
      author: AUTHOR,
    });
    const edited = ((await res.json()) as { post: ForumTopic }).post;
    expect(edited).toMatchObject({
      title: 'Exporting a diagram as PNG',
      body: 'Edited question body',
      state: 'listed',
    });
    expect(edited.editedAt).toEqual(expect.any(Number));
    // Edited while the check is down, it waits again, seen by its author alone.
    const waiting = await patch(
      ada,
      { title: 'Exporting a diagram as PNG', body: 'Edited once more', author: AUTHOR },
      { ...env, AI: undefined },
    );
    expect(((await waiting.json()) as { post: ForumTopic }).post.state).toBe('pending');
    expect((await read(topic!.id)).res.status).toBe(404);
    expect((await patch(ada, { body: 'Malformed', author: AUTHOR }, env)).status).toBe(400);
    expect(
      (await call(`/posts/${topic!.id}`, { ...as(ada, { method: 'PATCH' }), body: '' })).status,
    ).toBe(400);
    expect(
      await (await patch(ada, { title: 'Exporting a diagram', body: 'Body words here' })).json(),
    ).toEqual({
      error: 'invalid_author',
    });
  });

  it('edits a reply’s words only, and a refused one can pass on edit', async () => {
    const { topic } = await ask();
    const res = await call(
      `/topics/${topic!.id}/replies`,
      as(bea, { method: 'POST' }, { body: 'Bad words', author: { name: 'Bea' } }),
      { ...env, AI: unsafe() },
    );
    const refused = ((await res.json()) as { reply: ForumReply }).reply;
    expect(refused.state).toBe('refused');
    const fixed = await call(
      `/posts/${refused.id}`,
      as(
        bea,
        { method: 'PATCH' },
        { title: 'ignored', body: 'Kind words', author: { name: 'Bea' } },
      ),
    );
    expect(((await fixed.json()) as { post: ForumReply }).post).toMatchObject({
      body: 'Kind words',
      state: 'listed',
    });
    expect((await read(topic!.id)).body!.replies).toHaveLength(1);
  });

  it('lets its author delete it, a topic with its replies', async () => {
    const { topic } = await ask();
    await reply(topic!.id);
    expect((await call(`/posts/${topic!.id}`, as(bea, { method: 'DELETE' }))).status).toBe(404);
    expect((await call(`/posts/${topic!.id}`, as(ada, { method: 'DELETE' }))).status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM forum_posts').get()).toEqual({ n: 0 });
  });
});

describe('reports', () => {
  it('hide a post for good after three browsers on three networks, as a gallery post', async () => {
    const { topic } = await ask();
    const { reply: r } = await reply(topic!.id);
    await reportThrice(r!.id);
    expect((await read(topic!.id)).body!.replies).toEqual([]);
    expect((await read(topic!.id, bea)).body!.replies[0]!.state).toBe('hidden');
    // Final: its author can't edit it back, but can delete it; nobody can report it any more.
    const edit = await call(
      `/posts/${r!.id}`,
      as(bea, { method: 'PATCH' }, { body: 'Better now', author: AUTHOR }),
    );
    expect(await edit.json()).toEqual({ error: 'post_hidden' });
    expect((await call(`/posts/${r!.id}/report`, fromBrowser(KEYS[0]!, '9.9.9.9'))).status).toBe(
      404,
    );
    expect((await call(`/posts/${r!.id}`, as(bea, { method: 'DELETE' }))).status).toBe(204);
  });

  it('hide a topic with its replies', async () => {
    const { topic } = await ask();
    await reply(topic!.id);
    await reportThrice(topic!.id);
    expect((await read(topic!.id)).res.status).toBe(404);
    expect((await list()).body.topics).toEqual([]);
    expect((await list('', ada)).body.topics[0]!.state).toBe('hidden');
  });

  it('need the browser’s key, a reason, and stay within the network’s budget', async () => {
    const { topic } = await ask();
    const noKey = await call(`/posts/${topic!.id}/report`, { method: 'POST', body: '{}' });
    expect(await noKey.json()).toEqual({ error: 'community_key_required' });
    const noReason = await call(`/posts/${topic!.id}/report`, {
      ...fromBrowser(KEYS[0]!, '1.1.1.1'),
      body: '{}',
    });
    expect(await noReason.json()).toEqual({ error: 'invalid_reason' });
    const limited = { ...env, COMMUNITY_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    expect(
      (await call(`/posts/${topic!.id}/report`, fromBrowser(KEYS[0]!, '1.1.1.1'), limited)).status,
    ).toBe(429);
    // The same browser twice counts once.
    await call(`/posts/${topic!.id}/report`, fromBrowser(KEYS[0]!, '1.1.1.1'));
    await call(`/posts/${topic!.id}/report`, fromBrowser(KEYS[0]!, '2.1.1.1'));
    expect((await read(topic!.id)).res.status).toBe(200);
  });
});

describe('a closed account', () => {
  it('takes everything it wrote in the Forum with it', async () => {
    const { topic } = await ask();
    const { topic: theirs } = await ask(bea, { title: 'Bea asks something' });
    await reply(theirs!.id, ada, 'Ada answers Bea');
    await call(`/posts/${theirs!.id}/reactions/thanks`, as(ada, { method: 'PUT' }));
    await reply(topic!.id, bea, 'Bea answers Ada');
    const res = await worker.fetch(
      new Request('https://liveworkspace.app/api/community/app/copiers/forget', {
        method: 'POST',
        body: JSON.stringify({ copier: 'hash', owner: 'user_ada' }),
        headers: { Authorization: 'Bearer ld-key', 'X-Community-App': 'livediagram.app' },
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(204);
    // Ada's topic went with Bea's reply under it; Bea's topic stays without Ada's reply or reaction.
    expect((await read(topic!.id)).res.status).toBe(404);
    const left = (await read(theirs!.id)).body!;
    expect(left.replies).toEqual([]);
    expect(left.topic.reactions.counts.thanks).toBe(0);
    expect(
      db.sql
        .prepare("SELECT COUNT(*) AS n FROM forum_counters WHERE subject LIKE '%user_ada'")
        .get(),
    ).toEqual({ n: 0 });
  });
});

describe('the check', () => {
  it('reads every shape the model answers in', () => {
    expect(readVerdict({ response: { safe: true } })).toBe('pass');
    expect(readVerdict({ response: { safe: false, categories: ['S1'] } })).toBe('refuse');
    expect(readVerdict({ safe: true })).toBe('pass');
    expect(readVerdict({ response: 'safe' })).toBe('pass');
    expect(readVerdict({ response: ' unsafe\nS10' })).toBe('refuse');
    expect(readVerdict('safe')).toBe('pass');
    expect(readVerdict({ response: { verdict: 'ok' } })).toBe('unavailable');
    expect(readVerdict({ response: 'maybe' })).toBe('unavailable');
    expect(readVerdict(null)).toBe('unavailable');
    expect(readVerdict(42)).toBe('unavailable');
  });

  it('leaves a post an edit changed since the retry read it', async () => {
    const { topic } = await ask(ada, {}, { ...env, AI: undefined });
    const stale = (await getForumPost(env, topic!.id))!;
    db.sql
      .prepare('UPDATE forum_posts SET checked_at = checked_at + 1 WHERE id = ?')
      .run(topic!.id);
    await settleCheck(env, stale, 'refuse', Date.now());
    expect((await getForumPost(env, topic!.id))!.state).toBe('pending');
  });

  it('runs from the cron, which also drops old counters', async () => {
    db.sql.prepare("INSERT INTO forum_counters (subject, bucket, n) VALUES ('w:old', 0, 3)").run();
    const { topic } = await ask(ada, {}, { ...env, AI: undefined });
    db.sql.prepare('UPDATE forum_posts SET checked_at = 0 WHERE id = ?').run(topic!.id);
    worker.scheduled({} as ScheduledController, env, ctx);
    await Promise.all(waits);
    expect((await getForumPost(env, topic!.id))!.state).toBe('listed');
    expect(
      db.sql.prepare("SELECT COUNT(*) AS n FROM forum_counters WHERE subject = 'w:old'").get(),
    ).toEqual({ n: 0 });
  });

  it('logs a retry that fails and never throws from the cron', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broke = {
      ...env,
      COMMUNITY_DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    } as unknown as Env;
    worker.scheduled(
      {} as ScheduledController,
      { ...broke, APP_ORIGIN_LIVEDIAGRAM: undefined },
      ctx,
    );
    await Promise.allSettled(waits);
    expect(error).toHaveBeenCalledWith('[forum] retry failed', expect.anything());
  });
});

// Measured: a signed-in reader's page is their own waiting topics, then the page (with its reply counts); a topic is
// the question, its replies, then every post's reactions at once.
const LIST_STATEMENTS = 2;
const READ_STATEMENTS = 3;

describe('at scale', () => {
  // 2,000 topics by 40 authors, the first 50 each with a full topic of replies, every post with reactions: a page of
  // the list, and the fullest topic, each stay a few statements and well inside a Worker's CPU.
  function seed() {
    const post = db.sql.prepare(
      `INSERT INTO forum_posts (id, topic_id, category, author_id, author_name, author_color, title, body, state,
         created_at, activity_at) VALUES (?, ?, 'livediagram', ?, 'Someone', '#2563eb', ?, ?, 'listed', ?, ?)`,
    );
    const react = db.sql.prepare(
      `INSERT INTO forum_reactions (post_id, account_id, reaction, created_at) VALUES (?, ?, 'helpful', 0)`,
    );
    db.sql.exec('BEGIN');
    for (let t = 0; t < 2000; t++) {
      post.run(`t${t}`, null, `user_${t % 40}`, `Question number ${t}`, 'x'.repeat(400), t, t);
      for (let k = 0; k < 3; k++) react.run(`t${t}`, `user_${k}`);
      if (t < 50)
        for (let r = 0; r < FORUM_REPLIES_MAX; r++) {
          post.run(`t${t}r${r}`, `t${t}`, `user_${r % 40}`, '', 'y'.repeat(200), t + r, t + r);
          react.run(`t${t}r${r}`, 'user_1');
        }
    }
    db.sql.exec('COMMIT');
  }

  // The env with its database counting the statements it prepares.
  function counted(): { env: Env; statements: () => number } {
    let n = 0;
    const counting = new Proxy(env.COMMUNITY_DB, {
      get(target, prop) {
        if (prop === 'prepare')
          return (query: string) => {
            n++;
            return target.prepare(query);
          };
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    });
    return { env: { ...env, COMMUNITY_DB: counting }, statements: () => n };
  }

  it('lists a page, and reads the fullest topic, in a few statements and little CPU', async () => {
    seed();
    const listing = counted();
    let page: ForumTopicsResponse = { topics: [], nextOffset: null };
    const listMs = await cpuMsOfAsync(async () => {
      const res = await call('/topics', as(ada), listing.env);
      page = (await res.json()) as ForumTopicsResponse;
    });
    expect(page.topics).toHaveLength(FORUM_PAGE_SIZE);

    const reading = counted();
    let topic: ForumTopicResponse | null = null;
    const readMs = await cpuMsOfAsync(async () => {
      const res = await call('/topics/t0', as(ada), reading.env);
      topic = (await res.json()) as ForumTopicResponse;
    });
    expect(topic!.replies).toHaveLength(FORUM_REPLIES_MAX);
    expect(listing.statements()).toBeLessThanOrEqual(LIST_STATEMENTS);
    expect(reading.statements()).toBeLessThanOrEqual(READ_STATEMENTS);
    // CPU-time budgets for a shared CI runner, far above what each takes.
    expect(listMs).toBeLessThan(cpuBudgetMs(500));
    expect(readMs).toBeLessThan(cpuBudgetMs(500));
  });
});
