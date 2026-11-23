import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
// Emails are never really sent: the client's send is a recorder.
vi.mock('../email/client', async (original) => ({
  ...(await original<typeof import('../email/client')>()),
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

import type { TeamPerson } from '@liveworkspace/auth-client';
import {
  READING_CHANGES_PER_MINUTE,
  READING_PEOPLE_MAX,
  READING_REMIND_GAP_MS,
  REQUIRED_READING_PAGES_MAX,
  type KnowledgeOverviewResponse,
  type PageReadingResponse,
  type ReadingRemindResult,
} from '@liveknowledge/api-schema';
import { sendEmail } from '../email/client';
import { KNOWLEDGE_EMAILS_PER_DAY, pruneEmailMarks } from '../knowledge/email-marks';
import { __forgetReadingTeams } from '../knowledge/reading-people';
import { ACCOUNTS_ON, profileOf, stubAccounts, type FakeAccounts } from '../test-accounts';
import { knowledgeKit, OWNER, type Kit, type Who } from './knowledge-test-kit';
import { parseReadingChange } from './knowledge-reading-routes';

// docs/specs/030-knowledgebase/required-reading.md: who requires a page, who is asked and confirms, who sees who has
// read it, asking again, Remind's week and ceiling, the bounds and the overview's counts.

// Each test starts two minutes on, so the per-minute rate (a module's map) never carries from one to the next.
let T0 = Date.UTC(2026, 10, 22, 9);
const TEAM = 'team1';
const EMAIL_ON = {
  ...ACCOUNTS_ON,
  EMAIL: { send: vi.fn(async () => ({ messageId: 'm' })) } as unknown as SendEmail,
  APP_BASE_URL: 'https://app.test',
};
const member = (userId: string, name: string): TeamPerson => ({
  id: `m-${userId}`,
  userId,
  email: `${userId}@x.test`,
  name,
  role: 'member',
  status: 'joined',
});

let kit: Kit;
let fake: FakeAccounts;
let clock: { mockReturnValue: (now: number) => unknown };
const at = (now: number) => clock.mockReturnValue(now);

const PRESS = { confirm: 'read', again: 'read-again', remind: 'remind-readers' } as const;
const path = (tab = 'deploys', action?: keyof typeof PRESS) =>
  `/api/documents/kb/pages/${tab}/${action ? PRESS[action] : 'reading'}`;
const read = async (who: Who, tab = 'deploys') =>
  (await kit.call(who, 'GET', path(tab))).json<PageReadingResponse>();
const require = (who: Who, body: unknown, tab = 'deploys') => kit.call(who, 'PUT', path(tab), body);
const act = (who: Who, action: 'confirm' | 'again' | 'remind', tab = 'deploys') =>
  kit.call(who, 'POST', path(tab, action));
const errorOf = async (res: Response) => (await res.json<{ error: string }>()).error;
const setOwner = (tab: string, owner: string) =>
  kit.db.sql
    .prepare(
      `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = ?`,
    )
    .run(JSON.stringify({ owner }), tab);
const count = (table: string) =>
  (kit.db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const emailed = () =>
  vi
    .mocked(sendEmail)
    .mock.calls.map(([, e]) => e.to)
    .sort();

async function start(env: object = EMAIL_ON) {
  fake = stubAccounts();
  kit = await knowledgeKit(env);
  kit.db.sql.prepare(`UPDATE document SET team_id = ? WHERE id = 'kb'`).run(TEAM);
  fake.teams.set(TEAM, [member(OWNER, 'Olu'), member('user_p', 'Priya'), member('user_v', 'Vic')]);
  for (const id of [OWNER, 'user_p', 'user_v']) fake.emails.set(id, `${id}@x.test`);
  fake.profiles.set('user_p', profileOf('user_p', 'Priya', null));
  vi.mocked(sendEmail).mockClear();
}

beforeEach(async () => {
  T0 += 120_000;
  clock = vi.spyOn(Date, 'now').mockReturnValue(T0);
  __forgetReadingTeams();
  await start();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('parseReadingChange', () => {
  it('takes everyone, chosen people (deduplicated) and a stop, and refuses the rest', () => {
    expect(parseReadingChange({ audience: 'everyone', people: ['user_a'] })).toEqual({
      audience: 'everyone',
      people: [],
    });
    expect(parseReadingChange({ audience: 'people', people: ['user_a', 'user_a'] })).toEqual({
      audience: 'people',
      people: ['user_a'],
    });
    expect(parseReadingChange({ audience: null })).toEqual({ audience: null, people: [] });
    for (const bad of [
      null,
      'x',
      {},
      { audience: 'team' },
      { audience: 'people' },
      { audience: 'people', people: [] },
      { audience: 'people', people: ['guest_1'] },
      { audience: 'people', people: [3] },
    ])
      expect(parseReadingChange(bad)).toBe('invalid_change');
    const many = Array.from({ length: READING_PEOPLE_MAX + 1 }, (_, i) => `user_${i}`);
    expect(parseReadingChange({ audience: 'people', people: many })).toBe('too_many_people');
  });
});

describe('pages/:tab/reading', () => {
  it.each(['editor', 'participant', 'viewer', 'link', 'page-link', 'agent'] as const)(
    'reads a page that is not required for %s, from one read',
    async (who) => {
      const tab = who === 'page-link' ? 'holidays' : 'deploys';
      expect(await read(who, tab)).toEqual({
        required: null,
        mine: { asked: false },
        progress: null,
        sees: who === 'editor',
        manages: who === 'editor',
        email: true,
      });
    },
  );

  it('lets an Editor require a page for everyone: the team is asked, and counted', async () => {
    const res = await require('editor', { audience: 'everyone' });
    expect(res.status).toBe(200);
    const body = await res.json<PageReadingResponse>();
    expect(body.required).toEqual({ audience: 'everyone', askedAt: T0, round: 1 });
    expect(body.progress).toEqual({ done: 0, total: 3 });
    expect(body.people?.map((p) => p.name)).toEqual(['Olu', 'Priya', 'Vic']);
    // Each member is asked; a guest through a link is told the counts and is not asked.
    expect((await read('viewer')).mine).toEqual({ asked: true });
    expect((await read('participant')).mine).toEqual({ asked: true });
    expect(await read('link')).toMatchObject({ mine: { asked: false }, progress: { total: 3 } });
  });

  it.each(['participant', 'viewer', 'link', 'edit-link', 'agent', 'agent-stored'] as const)(
    'refuses %s requiring, changing, stopping or asking again',
    async (who) => {
      await require('editor', { audience: 'everyone' });
      for (const res of [
        await require(who, { audience: 'everyone' }),
        await require(who, { audience: null }),
        await act(who, 'again'),
      ]) {
        expect(res.status).toBe(403);
        // A token without the write scope is stopped before the route, by the grant.
        expect(['forbidden', 'scope_needed']).toContain(await errorOf(res));
      }
      expect((await read('editor')).required?.round).toBe(1);
    },
  );

  it('records I’ve Read This once, by who and when, and counts it', async () => {
    await require('editor', { audience: 'everyone' });
    at(T0 + 60_000);
    const res = await act('viewer', 'confirm');
    expect(res.status).toBe(200);
    expect(await res.json<PageReadingResponse>()).toMatchObject({
      mine: { asked: true, readAt: T0 + 60_000 },
      progress: { done: 1, total: 3 },
      sees: false,
    });
    // Pressing again keeps the first time.
    at(T0 + 120_000);
    expect((await (await act('viewer', 'confirm')).json<PageReadingResponse>()).mine.readAt).toBe(
      T0 + 60_000,
    );
  });

  it('shows who has and hasn’t read it to an Editor and the page’s owner only', async () => {
    await require('editor', { audience: 'everyone' });
    await act('viewer', 'confirm');
    const editor = await read('editor');
    expect(editor.people).toEqual([
      { id: OWNER, name: 'Olu' },
      { id: 'user_p', name: 'Priya' },
      { id: 'user_v', name: 'Vic', readAt: T0 },
    ]);
    for (const who of ['participant', 'viewer', 'link', 'agent'] as const) {
      const body = await read(who);
      expect(body.sees).toBe(false);
      expect(body.people).toBeUndefined();
      expect(body.chosen).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('user_');
    }
    // The page's owner sees them, whatever their role, and may not change it.
    setOwner('deploys', 'user_v');
    expect(await read('viewer')).toMatchObject({ sees: true, manages: false });
    expect((await read('viewer')).people).toHaveLength(3);
  });

  it('asks chosen people alone: someone not chosen is told so', async () => {
    const res = await require('editor', { audience: 'people', people: ['user_p'] });
    expect(await res.json<PageReadingResponse>()).toMatchObject({
      progress: { done: 0, total: 1 },
      chosen: ['user_p'],
      people: [{ id: 'user_p', name: 'Priya' }],
    });
    expect((await read('viewer')).mine).toEqual({ asked: false });
    const refused = await act('viewer', 'confirm');
    expect([refused.status, await errorOf(refused)]).toEqual([409, 'not_asked']);
    expect((await act('participant', 'confirm')).status).toBe(200);
    expect((await read('editor')).progress).toEqual({ done: 1, total: 1 });
    // The chosen list is the Editor's alone.
    expect((await read('participant')).chosen).toBeUndefined();
  });

  it('names a chosen person outside the team from their profile, else Someone', async () => {
    fake.profiles.set('user_z', profileOf('user_z', 'Zed', null));
    await require('editor', { audience: 'people', people: ['user_z', 'user_q'] });
    expect((await read('editor')).people?.map((p) => p.name)).toEqual(['Zed', 'Someone']);
  });

  it.each(['link', 'edit-link', 'page-edit-link', 'agent', 'viewer-agent'] as const)(
    'refuses %s a confirmation: there is nobody to count',
    async (who) => {
      await require('editor', { audience: 'everyone' }, 'rollbacks');
      const res = await act(who, 'confirm', 'rollbacks');
      expect([res.status, await errorOf(res)]).toEqual([403, 'reading_needs_account']);
    },
  );

  it('refuses a confirmation, an ask and a reminder on a page that is not required', async () => {
    for (const res of [
      await act('viewer', 'confirm'),
      await act('editor', 'again'),
      await act('editor', 'remind'),
    ])
      expect([res.status, await errorOf(res)]).toEqual([409, 'not_required']);
  });

  it('asks everyone again: confirmations clear, a new round starts, and they count again', async () => {
    await require('editor', { audience: 'everyone' });
    await act('viewer', 'confirm');
    await act('participant', 'confirm');
    at(T0 + 3_600_000);
    const res = await act('editor', 'again');
    expect(await res.json<PageReadingResponse>()).toMatchObject({
      required: { askedAt: T0 + 3_600_000, round: 2 },
      progress: { done: 0, total: 3 },
    });
    expect((await read('viewer')).mine).toEqual({ asked: true });
    await act('viewer', 'confirm');
    expect((await read('editor')).progress).toEqual({ done: 1, total: 3 });
  });

  it('keeps the round and confirmations when an Editor changes who, and counts the chosen only', async () => {
    await require('editor', { audience: 'everyone' });
    await act('viewer', 'confirm');
    await act('participant', 'confirm');
    const narrowed = await require('editor', { audience: 'people', people: ['user_p', OWNER] });
    expect(await narrowed.json<PageReadingResponse>()).toMatchObject({
      required: { round: 1, askedAt: T0 },
      progress: { done: 1, total: 2 },
    });
    // Back to everyone, Vic's confirmation counts again.
    await require('editor', { audience: 'everyone' });
    expect((await read('editor')).progress).toEqual({ done: 2, total: 3 });
  });

  it('stops requiring: the requirement and its confirmations go', async () => {
    await require('editor', { audience: 'everyone' });
    await act('viewer', 'confirm');
    const res = await require('editor', { audience: null });
    expect((await res.json<PageReadingResponse>()).required).toBeNull();
    expect(count('page_required_reading')).toBe(0);
    expect(count('page_read_confirmations')).toBe(0);
    // Stopping a page that was not required answers the same.
    expect((await require('editor', { audience: null })).status).toBe(200);
  });

  it('counts a confirmer outside the team under Everyone, and the owner of a knowledgebase with no team', async () => {
    kit.db.sql.exec(`UPDATE document SET team_id = NULL WHERE id = 'kb'`);
    await require('editor', { audience: 'everyone' });
    expect((await read('editor')).progress).toEqual({ done: 0, total: 1 });
    await act('viewer', 'confirm');
    expect((await read('editor')).progress).toEqual({ done: 1, total: 2 });
  });

  it('refuses a bad change, too many people, and a page past the bound', async () => {
    expect(await errorOf(await require('editor', { audience: 'team' }))).toBe('invalid_change');
    const many = Array.from({ length: READING_PEOPLE_MAX + 1 }, (_, i) => `user_${i}`);
    const tooMany = await require('editor', { audience: 'people', people: many });
    expect([tooMany.status, await errorOf(tooMany)]).toEqual([400, 'too_many_people']);
    const insert = kit.db.sql.prepare(
      `INSERT INTO page_required_reading (tab, audience, set_by, set_at, asked_at) VALUES (?, 'everyone', ?, 1, 1)`,
    );
    for (let i = 0; i < REQUIRED_READING_PAGES_MAX; i++) insert.run(`gone-${i}`, OWNER);
    const full = await require('editor', { audience: 'everyone' });
    expect([full.status, await errorOf(full)]).toEqual([409, 'reading_pages_full']);
    // A page already required still changes at the bound.
    insert.run('deploys', OWNER);
    expect((await require('editor', { audience: 'people', people: ['user_p'] })).status).toBe(200);
  });

  it('limits confirmations and changes a minute a person', async () => {
    await require('editor', { audience: 'everyone' }, 'holidays');
    let last: Response | undefined;
    for (let i = 0; i < READING_CHANGES_PER_MINUTE + 1; i++)
      last = await act('participant', 'confirm', 'holidays');
    expect([last!.status, await errorOf(last!)]).toEqual([429, 'reading_too_fast']);
  });

  it('answers 405 for a wrong method', async () => {
    expect((await kit.call('editor', 'DELETE', path())).status).toBe(405);
    expect((await kit.call('editor', 'POST', path())).status).toBe(405);
    expect((await kit.call('editor', 'GET', path('deploys', 'confirm'))).status).toBe(405);
  });

  it('drops a page’s rows when it is deleted for good, and a closed account’s', async () => {
    await require('editor', { audience: 'people', people: ['user_v', 'user_p'] });
    await act('viewer', 'confirm');
    const { anonymiseDocument } = await import('../document-room/document-anonymise');
    await anonymiseDocument(kit.db.env, 'kb', 'user_v');
    expect(count('page_read_confirmations')).toBe(0);
    expect((await read('editor')).chosen).toEqual(['user_p']);
    kit.db.sql.exec("DELETE FROM tabs WHERE id = 'deploys'");
    expect(count('page_required_reading')).toBe(0);
  });
});

describe('pages/:tab/remind-readers', () => {
  it('emails each person not yet read once, and holds them for a week', async () => {
    await require('editor', { audience: 'everyone' });
    await act('editor', 'confirm');
    const res = await act('editor', 'remind');
    expect(await res.json<ReadingRemindResult>()).toEqual({ outcome: 'sent', sent: 2 });
    expect(emailed()).toEqual(['user_p@x.test', 'user_v@x.test']);
    const email = vi.mocked(sendEmail).mock.calls[0]![1] as {
      subject: string;
      kind: string;
      html: string;
    };
    expect(email).toMatchObject({ subject: 'Please Read Deploys', kind: 'ReadingReminder' });
    expect(email.html).toContain('https://app.test/document/kb#t=deploys');
    expect((await read('editor')).people?.find((p) => p.id === 'user_p')?.remindedAt).toBe(T0);
    expect((await read('editor')).remindedAt).toBe(T0);
    // Inside the week, nobody is emailed again.
    at(T0 + 86_400_000);
    expect(await (await act('editor', 'remind')).json<ReadingRemindResult>()).toEqual({
      outcome: 'already_sent',
      nextAt: T0 + READING_REMIND_GAP_MS,
    });
    expect(emailed()).toHaveLength(2);
    // A week on, those still not read are reminded again.
    await act('viewer', 'confirm');
    at(T0 + READING_REMIND_GAP_MS + 1);
    expect(await (await act('editor', 'remind')).json<ReadingRemindResult>()).toEqual({
      outcome: 'sent',
      sent: 1,
    });
  });

  it('lets the page’s owner remind, never another reader', async () => {
    await require('editor', { audience: 'everyone' });
    for (const who of ['participant', 'viewer', 'link', 'agent'] as const)
      expect(await errorOf(await act(who, 'remind'))).toBe('forbidden');
    setOwner('deploys', 'user_v');
    expect((await (await act('viewer', 'remind')).json<ReadingRemindResult>()).outcome).toBe(
      'sent',
    );
  });

  it('respects a person’s Knowledgebase Reviews switch, and still holds them for the week', async () => {
    fake.settings.set('user_v', { all: {}, app: { notifyKnowledgeReviews: false } });
    await require('editor', { audience: 'people', people: ['user_v', 'user_p'] });
    expect(await (await act('editor', 'remind')).json<ReadingRemindResult>()).toEqual({
      outcome: 'sent',
      sent: 1,
    });
    expect(emailed()).toEqual(['user_p@x.test']);
    expect((await read('editor')).people?.every((p) => p.remindedAt === T0)).toBe(true);
  });

  it('answers nobody pending, no recipients, the daily limit and no email', async () => {
    await require('editor', { audience: 'people', people: ['user_p'] });
    await act('participant', 'confirm');
    expect((await (await act('editor', 'remind')).json<ReadingRemindResult>()).outcome).toBe(
      'nobody_pending',
    );
    // Someone who no longer reaches the knowledgebase is emailed nothing.
    await require('editor', { audience: 'people', people: ['user_gone'] });
    expect((await (await act('editor', 'remind')).json<ReadingRemindResult>()).outcome).toBe(
      'no_recipients',
    );
    // The day's ceiling, shared with the review emails.
    kit.db.sql
      .prepare(
        `INSERT OR REPLACE INTO usage_counters (scope, period, used) VALUES ('emails', ?, ?)`,
      )
      .run(new Date(T0).toISOString().slice(0, 10), KNOWLEDGE_EMAILS_PER_DAY);
    await require('editor', { audience: 'people', people: ['user_v'] });
    expect((await (await act('editor', 'remind')).json<ReadingRemindResult>()).outcome).toBe(
      'daily_limit',
    );
    await start(ACCOUNTS_ON);
    await require('editor', { audience: 'everyone' });
    expect(await (await act('editor', 'remind')).json<ReadingRemindResult>()).toEqual({
      outcome: 'unavailable',
    });
    expect((await read('editor')).email).toBe(false);
  });

  it('prunes a reminder’s mark a day past its week', async () => {
    await require('editor', { audience: 'people', people: ['user_p'] });
    await act('editor', 'remind');
    const marks = () => count("knowledge_email_marks WHERE kind = 'reading-remind'");
    expect(marks()).toBe(1);
    const run = (now: number) => {
      for (const s of pruneEmailMarks(now)) kit.db.sql.prepare(s.sql).run(...s.params);
    };
    run(T0 + 7 * 86_400_000);
    expect(marks()).toBe(1);
    run(T0 + 8 * 86_400_000 + 1);
    expect(marks()).toBe(0);
  });
});

describe('the Insights overview', () => {
  it('lists each Required Reading page with its counts, least read first, for every role', async () => {
    await require('editor', { audience: 'everyone' });
    await require('editor', { audience: 'people', people: ['user_p'] }, 'holidays');
    await act('participant', 'confirm', 'holidays');
    await act('viewer', 'confirm');
    for (const who of ['editor', 'viewer'] as const) {
      const overview = await (
        await kit.call(who, 'GET', '/api/documents/kb/knowledge')
      ).json<KnowledgeOverviewResponse>();
      expect(overview.requiredReading).toEqual([
        { tab: 'deploys', title: 'Deploys', audience: 'everyone', done: 1, total: 3 },
        { tab: 'holidays', title: 'Holidays', audience: 'people', done: 1, total: 1 },
      ]);
    }
  });

  it('reads the team once a minute however many pages ask everyone', async () => {
    await require('editor', { audience: 'everyone' });
    await require('editor', { audience: 'everyone' }, 'holidays');
    __forgetReadingTeams();
    const before = fake.calls.length;
    await kit.call('editor', 'GET', '/api/documents/kb/knowledge');
    await read('viewer');
    const teamReads = fake.calls.slice(before).filter((c) => c.path.includes('team'));
    expect(teamReads.length).toBeLessThanOrEqual(1);
  });
});
