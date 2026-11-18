// The Forum's upkeep (liveworkspace/docs/specs/007-community/community.md "The check"): each check's outcome and Neurons
// tallied by day, the Neuron budget held, the tally read for the dashboard, and old reports pruned by the cron.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import {
  FORUM_CHECK_TALLY_KEEP_DAYS,
  FORUM_NEURONS_PER_DAY,
  FORUM_REPORTS_KEEP_MS,
} from '../config';
import type { Env, ForumAi } from '../env';
import { testDb, type TestDb } from '../test-sqlite-d1';
import { checkForumText, retryForumChecks } from './check';
import { DAY_MS } from './rate';
import { getForumPost, insertForumPost, recordForumReport } from './store';
import { neuronsOf, readChecks } from './tally';

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
// A clock on an hour's first minutes, so the cron's hourly prune runs.
const NOW = Date.UTC(2026, 10, 18, 10, 2);
const DAY = Math.floor(NOW / DAY_MS) * DAY_MS;

let db: TestDb;
let env: Env;
const ai = (answer: unknown): ForumAi => ({ run: vi.fn(async () => answer) });
const tallyOf = async (now = NOW) => (await readChecks(env, now, 2)).days.at(-1)!;

beforeEach(() => {
  db = testDb({ ENVIRONMENT: 'production', AI: ai({ response: { safe: true } }) });
  env = db.env;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('the Neurons a check used', () => {
  it('come from the tokens the model reports, rounded up', () => {
    // 1,000 input tokens = 44.003 Neurons; 100 output = 0.273: 45.
    expect(neuronsOf({ usage: { prompt_tokens: 1000, completion_tokens: 100 } }, 'x')).toBe(45);
  });

  it('are worked out from the text sent when the model reports none', () => {
    expect(neuronsOf({ response: { safe: true } }, 'a'.repeat(4000))).toBe(45);
    expect(neuronsOf(null, '')).toBe(0);
    expect(neuronsOf({ usage: { prompt_tokens: -3, completion_tokens: 'many' } }, 'abcd')).toBe(1);
  });
});

describe('the check’s tally', () => {
  it('counts each outcome and the Neurons used, in the day it happened', async () => {
    const run = ai({
      response: { safe: true },
      usage: { prompt_tokens: 1000, completion_tokens: 10 },
    });
    await checkForumText({ ...env, AI: run }, 'one', NOW);
    await checkForumText({ ...env, AI: ai({ response: { safe: false } }) }, 'x'.repeat(8000), NOW);
    await checkForumText({ ...env, AI: ai('maybe') }, '', NOW);
    await checkForumText({ ...env, AI: ai('safe') }, 'a'.repeat(8000), NOW + DAY_MS);
    const today = await tallyOf();
    expect(today).toMatchObject({ day: DAY, listed: 1, refused: 1, waiting: 1 });
    expect(today.neurons).toBe(45 + 89);
    expect((await tallyOf(NOW + DAY_MS)).listed).toBe(1);
  });

  it('counts a check that could not answer as waiting, with no Neurons', async () => {
    const failing: ForumAi = {
      run: async () => {
        throw new Error('3040');
      },
    };
    await checkForumText({ ...env, AI: failing }, 'text', NOW);
    expect(await tallyOf()).toMatchObject({ listed: 0, refused: 0, waiting: 1, neurons: 0 });
  });

  it('stops asking past the day’s Neuron budget, and counts it as waiting', async () => {
    db.sql
      .prepare('INSERT INTO forum_counters (subject, bucket, n) VALUES (?, ?, ?)')
      .run('chk:neurons', DAY, FORUM_NEURONS_PER_DAY);
    expect(await checkForumText(env, 'text', NOW)).toBe('unavailable');
    expect((env.AI as { run: ReturnType<typeof vi.fn> }).run).not.toHaveBeenCalled();
    expect(await tallyOf()).toMatchObject({ waiting: 1, neurons: FORUM_NEURONS_PER_DAY });
    // The next day's budget is whole.
    expect(await checkForumText(env, 'text', NOW + DAY_MS)).toBe('pass');
  });

  it('never changes the answer when the tally cannot be written', async () => {
    const real = env.COMMUNITY_DB;
    const broken = {
      prepare: real.prepare.bind(real),
      batch: () => Promise.reject(new Error('d1 down')),
    } as unknown as D1Database;
    expect(await checkForumText({ ...env, COMMUNITY_DB: broken }, 'text', NOW)).toBe('pass');
    expect(console.warn).toHaveBeenCalledWith('[forum] tally failed', expect.anything());
  });

  it('is public counts only, 30 days oldest first, with the caps', async () => {
    await checkForumText(env, 'text', Date.now());
    const res = await worker.fetch(
      new Request('https://liveworkspace.app/api/community/forum/checks'),
      env,
      ctx,
    );
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    const body = (await res.json()) as Awaited<ReturnType<typeof readChecks>>;
    expect(body.caps).toEqual({ checks: 500, neurons: FORUM_NEURONS_PER_DAY });
    expect(body.days).toHaveLength(30);
    expect(body.days.at(-1)).toMatchObject({ listed: 1 });
    expect(Object.keys(body.days[0]!).sort()).toEqual(
      ['day', 'listed', 'neurons', 'refused', 'waiting'].sort(),
    );
  });

  it('is kept for 90 days by the cron, while other counters go after two', async () => {
    const keep = FORUM_CHECK_TALLY_KEEP_DAYS * DAY_MS;
    const put = db.sql.prepare('INSERT INTO forum_counters (subject, bucket, n) VALUES (?, ?, 1)');
    put.run('chk:listed', NOW - keep + DAY_MS);
    put.run('chk:listed', NOW - keep - DAY_MS);
    put.run('w:ada', NOW - 3 * DAY_MS);
    await retryForumChecks(env, NOW);
    const left = db.sql.prepare('SELECT subject, bucket FROM forum_counters').all();
    expect(left).toEqual([{ subject: 'chk:listed', bucket: NOW - keep + DAY_MS }]);
  });
});

describe('reports older than the window', () => {
  const author = { name: 'Ada', color: '#2563eb' };
  const topic = () =>
    insertForumPost(
      env,
      {
        topicId: null,
        category: 'question',
        app: null,
        accountId: 'user_ada',
        author,
        title: 'A question here',
        body: 'The body of the question',
        state: 'listed',
      },
      NOW,
    );
  const report = (id: string, n: number, at: number) =>
    recordForumReport(env, id, `key-${n}`, `net-${n}`, 'spam', null, at);
  const reportsOf = (id: string) =>
    (
      db.sql.prepare('SELECT COUNT(*) AS n FROM forum_reports WHERE post_id = ?').get(id) as {
        n: number;
      }
    ).n;

  it('are pruned by the cron, those within the window kept', async () => {
    const { id } = await topic();
    await report(id, 1, NOW - FORUM_REPORTS_KEEP_MS - 1);
    await report(id, 2, NOW - FORUM_REPORTS_KEEP_MS + DAY_MS);
    await retryForumChecks(env, NOW);
    expect(reportsOf(id)).toBe(1);
  });

  it('are pruned once an hour, not on every cron run', async () => {
    const { id } = await topic();
    await report(id, 1, NOW - FORUM_REPORTS_KEEP_MS - 1);
    await retryForumChecks(env, NOW + 10 * 60_000);
    expect(reportsOf(id)).toBe(1);
  });

  it('still hide a post: reports in the window count, and hidden stays hidden once they are pruned', async () => {
    const { id } = await topic();
    await report(id, 1, NOW - 1000);
    await report(id, 2, NOW - 1000);
    // The third, within the window, still counts the first two.
    expect(await report(id, 3, NOW)).toBe(true);
    expect((await getForumPost(env, id))!.state).toBe('hidden');
    await retryForumChecks(env, NOW + FORUM_REPORTS_KEEP_MS + DAY_MS);
    expect(reportsOf(id)).toBe(0);
    expect((await getForumPost(env, id))!.state).toBe('hidden');
  });

  it('are pruned when their post is gone', async () => {
    const { id } = await topic();
    await report(id, 1, NOW);
    db.sql.prepare('PRAGMA foreign_keys = OFF').run();
    db.sql.prepare('DELETE FROM forum_posts WHERE id = ?').run(id);
    expect(reportsOf(id)).toBe(1);
    await retryForumChecks(env, NOW);
    expect(reportsOf(id)).toBe(0);
  });
});
