import { subscriptionClientOf } from '@liveworkspace/subscription';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BY_OTHERS_SCOPE, OWNER_CREDITS_BY_OTHERS_PER_DAY } from '../knowledge/ai-credits';
import { runAll } from '../knowledge/knowledge-db';
import { confirmedHistoryDays, leaveItemCounts } from '../knowledge/tier-limits';
import { fakeSubscription, proEnv } from '../knowledge/tier-test-kit';
import { knowledgeKit, page, PAGES, type Kit } from './knowledge-test-kit';

// What Pro changes in a knowledgebase (docs/specs/030-knowledgebase/tiers.md), through the routes.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const OWNER_SCOPE = 'p:user_o';
const many = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    page(`p${i}`, `Page ${i}`, [{ id: `b${i}`, type: 'paragraph', runs: [{ text: `Page ${i}` }] }]),
  );
const create = (kit: Kit, title = 'Hotfixes') =>
  kit.call('agent-stored', 'POST', '/api/documents/kb/pages', { title, markdown: 'Any day.' });

/** A fake `AI` binding answering every built-in ask with one cited sentence. */
function fakeAi() {
  const sent: string[] = [];
  return {
    sent,
    run: async (model: string) => {
      sent.push(model);
      const encoder = new TextEncoder();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ response: '<answer>Tuesdays [1].</answer>' })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    },
  };
}

describe('Knowledgebase Pages', () => {
  // The owner already holds `n` pages over their other knowledgebases.
  const elsewhere = (fake: ReturnType<typeof fakeSubscription>, n: number) =>
    fake.items.set(`${OWNER_SCOPE}:pages:kb_other`, n);

  it('refuses a page past Free’s 500 over every knowledgebase, in the owner’s numbers, and Pro takes it', async () => {
    const fake = fakeSubscription();
    const kit = await knowledgeKit({}, many(10));
    proEnv(kit.db.env, fake);
    elsewhere(fake, 490);
    // This knowledgebase's 10, as it told them before.
    fake.items.set(`${OWNER_SCOPE}:pages:kb`, 10);
    const refused = await create(kit);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({
      error: 'page_limit',
      limit: 'knowledgebasePages',
      used: 500,
      max: 500,
    });
    fake.set(OWNER_SCOPE, 'pro');
    expect((await create(kit)).status).toBe(201);
    expect(fake.items.get(`${OWNER_SCOPE}:pages:kb`)).toBe(11);
  });

  it('tells one count a page added, one a page deleted, and keeps the fixed bound of 500 on Pro', async () => {
    const fake = fakeSubscription({ [OWNER_SCOPE]: 'pro' });
    const kit = await knowledgeKit({}, many(10));
    proEnv(kit.db.env, fake);
    expect((await create(kit)).status).toBe(201);
    expect(fake.to('item-count')).toEqual([
      expect.objectContaining({
        owner: OWNER_SCOPE,
        meter: 'pages',
        item: 'kb',
        used: 11,
        adding: true,
      }),
    ]);
    const full = await knowledgeKit({}, many(500));
    proEnv(full.db.env, fake);
    const refused = await create(full);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'page_limit' });
  });

  it('tells the new count when a page goes to the Trash, and meets the limit when it comes back', async () => {
    const fake = fakeSubscription();
    const kit = await knowledgeKit({}, many(10));
    proEnv(kit.db.env, fake);
    fake.items.set(`${OWNER_SCOPE}:pages:kb`, 10);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/p3')).status).toBe(204);
    expect(fake.items.get(`${OWNER_SCOPE}:pages:kb`)).toBe(9);
    // The owner's other knowledgebases fill the month's room: the page stays in the Trash.
    elsewhere(fake, 491);
    const refused = await kit.call('editor', 'POST', '/api/documents/kb/trash/p3/restore');
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      error: 'page_limit',
      limit: 'knowledgebasePages',
    });
    elsewhere(fake, 0);
    expect((await kit.call('editor', 'POST', '/api/documents/kb/trash/p3/restore')).status).toBe(
      200,
    );
    expect(fake.items.get(`${OWNER_SCOPE}:pages:kb`)).toBe(10);
  });

  it('tells the Trash’s count behind the answer, and only logs a count that could not be told', async () => {
    const fake = fakeSubscription();
    const behind: Promise<unknown>[] = [];
    const kit = await knowledgeKit({}, many(10), { waitUntil: (work) => void behind.push(work) });
    // The service answers nothing until it is let: the answer to the delete cannot be waiting on it.
    const heldService = () => {
      let open!: () => void;
      const gate = new Promise<void>((resolve) => (open = resolve));
      const fetcher: typeof fake.fetcher = {
        fetch: async (input, init) => {
          await gate;
          return fake.fetcher.fetch(input, init);
        },
      };
      proEnv(kit.db.env, { ...fake, fetcher });
      return open;
    };
    let open = heldService();
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/p3')).status).toBe(204);
    expect(fake.calls).toHaveLength(0);
    open();
    await Promise.all(behind);
    expect(fake.items.get(`${OWNER_SCOPE}:pages:kb`)).toBe(9);
    // A count that cannot be read is said in the log, and the page has gone all the same.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    open = heldService();
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/p4')).status).toBe(204);
    vi.spyOn(kit.db.env.DOCUMENT_DB, 'prepare').mockImplementation(() => {
      throw new Error('room gone');
    });
    open();
    await Promise.allSettled(behind);
    expect(warn).toHaveBeenCalledWith('[knowledge] pages.recount.failed', {
      error: 'Error: room gone',
    });
    expect(fake.items.get(`${OWNER_SCOPE}:pages:kb`)).toBe(9);
  });

  it('refuses an add the service cannot check, as unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fake = fakeSubscription();
    const kit = await knowledgeKit({}, many(10));
    proEnv(kit.db.env, fake);
    const answer = fake.fetcher.fetch;
    fake.fetcher.fetch = async (input, init) =>
      String(input).endsWith('/item-count')
        ? new Response(null, { status: 401 })
        : answer(input, init);
    const res = await create(kit);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
  });

  it('counts nothing with Pro off, and asks the service nothing', async () => {
    const fake = fakeSubscription();
    const kit = await knowledgeKit({}, many(100));
    Object.assign(kit.db.env, { SUBSCRIPTION: fake.fetcher });
    expect((await create(kit)).status).toBe(201);
    expect(fake.calls).toEqual([]);
  });

  it('tells the editor the figures on the document’s read, with Pro on only', async () => {
    const kit = await knowledgeKit();
    const read = async () =>
      (
        await (await kit.call('viewer', 'GET', '/api/documents/kb')).json<Record<string, unknown>>()
      )['knowledgeTier'];
    expect(await read()).toBeUndefined();
    proEnv(kit.db.env, fakeSubscription());
    expect(await read()).toEqual({
      pagesMax: 500,
      pagesLimit: 500,
      historyDays: 30,
      owner: OWNER_SCOPE,
    });
  });
});

describe('Built-in AI on AI credits', () => {
  // The owner asks (`editor` is the owner in the kit); `viewer` is someone else on a share.
  const ask = (kit: Kit, who: 'editor' | 'viewer' = 'editor') =>
    kit.call(who, 'POST', '/api/documents/kb/ask', { question: 'When do we deploy?' });

  it('spends one of the owner’s credits a question and says the month on the stream', async () => {
    const fake = fakeSubscription();
    const ai = fakeAi();
    const kit = await knowledgeKit({ AI: ai }, PAGES);
    proEnv(kit.db.env, fake);
    const res = await ask(kit);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Credits')).toBe('1/50');
    await res.text();
    expect(fake.to('spend')).toEqual([
      expect.objectContaining({ owner: OWNER_SCOPE, meter: 'aiCredits' }),
    ]);
  });

  it('refuses a question once the month is used, before the model is asked', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fake = fakeSubscription();
    fake.spent.set(`${OWNER_SCOPE}:aiCredits`, 50);
    const ai = fakeAi();
    const kit = await knowledgeKit({ AI: ai }, PAGES);
    proEnv(kit.db.env, fake);
    const res = await ask(kit);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: 'ai_credits_used',
      limit: 'aiCreditsPerMonth',
      max: 50,
    });
    expect(ai.sent).toEqual([]);
  });

  it('tells someone who is not the owner no figures, on the stream or the refusal', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fake = fakeSubscription();
    const kit = await knowledgeKit({ AI: fakeAi() }, PAGES);
    proEnv(kit.db.env, fake);
    const answered = await ask(kit, 'viewer');
    expect(answered.status).toBe(200);
    expect(answered.headers.get('X-AI-Credits')).toBeNull();
    await answered.text();
    fake.spent.set(`${OWNER_SCOPE}:aiCredits`, 50);
    const refused = await ask(kit, 'viewer');
    expect(refused.status).toBe(429);
    const body = await refused.json<Record<string, unknown>>();
    expect(body).toMatchObject({ error: 'ai_credits_used', limit: 'aiCreditsPerMonth' });
    expect(body).not.toHaveProperty('used');
    expect(body).not.toHaveProperty('max');
  });

  it('holds what others charge to the owner to 20 a day, and the owner asks on', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fake = fakeSubscription();
    const ai = fakeAi();
    const kit = await knowledgeKit({ AI: ai }, PAGES);
    proEnv(kit.db.env, fake);
    // The day's twenty by others, in the counter the spend keeps (the per-person caps stop one person sooner).
    await runAll(kit.db.env, [
      {
        sql: 'INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, ?)',
        params: [
          BY_OTHERS_SCOPE,
          new Date().toISOString().slice(0, 10),
          OWNER_CREDITS_BY_OTHERS_PER_DAY,
        ],
      },
    ]);
    const capped = await ask(kit, 'viewer');
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({
      error: 'ai_by_others_limit',
      message: expect.stringContaining('Try again tomorrow') as unknown,
    });
    expect(ai.sent).toEqual([]);
    expect(fake.to('spend')).toEqual([]);
    const owner = await ask(kit);
    expect(owner.status).toBe(200);
    await owner.text();
  });
});

describe('AI Knowledge History', () => {
  it('answers Most Read’s period within what the tier keeps, with Pro on only', async () => {
    const kit = await knowledgeKit();
    const read = async (days: number) =>
      await (
        await kit.call('editor', 'GET', `/api/documents/kb/knowledge?days=${days}`)
      ).json<Record<string, { days?: number } | undefined>>();
    const history = async (days: number) => (await read(days))['history'];
    // Not Read asks about the days kept, where fewer than 90.
    const notReadDays = async () => (await read(30))['notRead']?.days;
    expect(await history(90)).toBeUndefined();
    expect(await notReadDays()).toBe(90);
    const fake = fakeSubscription();
    proEnv(kit.db.env, fake);
    expect(await history(365)).toEqual({ keptDays: 30, days: 30, owner: OWNER_SCOPE });
    expect(await notReadDays()).toBe(30);
    fake.set(OWNER_SCOPE, 'pro');
    expect(await history(90)).toEqual({ keptDays: 365, days: 90, owner: OWNER_SCOPE });
    expect(await notReadDays()).toBe(90);
  });

  it('prunes by a confirmed tier only', async () => {
    const env = {} as Record<string, unknown>;
    const days = (head: { ownerId: string | null; teamId?: string | null }) =>
      confirmedHistoryDays(subscriptionClientOf(env, 'liveknowledge.app'), head);
    expect(await days({ ownerId: 'user_o' })).toBe(90);
    const fake = fakeSubscription({ [OWNER_SCOPE]: 'pro' });
    proEnv(env, fake);
    expect(await days({ ownerId: 'user_o' })).toBe(365);
    expect(await days({ ownerId: 'guest_1' })).toBe(30);
    expect(await days({ ownerId: null })).toBe(90);
    proEnv(env, { ...fake, fetcher: { fetch: async () => new Response('down', { status: 503 }) } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await days({ ownerId: 'user_o' })).toBeNull();
  });
});

describe('a knowledgebase going for good', () => {
  it('takes its pages and rules off its owner’s counts, reading the owner first, and asks nothing with Pro off', async () => {
    const told: [string, string, number][] = [];
    let fresh = false;
    const tier = {
      on: true,
      fresh: () => fresh,
      refresh: vi.fn(async () => {
        fresh = true;
      }),
      recount: (meter: string, item: string, used: number) => void told.push([meter, item, used]),
    };
    await leaveItemCounts(tier, 'kb');
    await leaveItemCounts(tier, 'kb');
    expect(tier.refresh).toHaveBeenCalledTimes(1);
    expect(told).toEqual([
      ['pages', 'kb', 0],
      ['rules', 'kb', 0],
      ['pages', 'kb', 0],
      ['rules', 'kb', 0],
    ]);
    await leaveItemCounts({ ...tier, on: false }, 'kb');
    expect(told).toHaveLength(4);
  });
});
