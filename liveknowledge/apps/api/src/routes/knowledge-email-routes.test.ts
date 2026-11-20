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
import type { KnowledgeEmailResult, KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { sendEmail } from '../email/client';
import { KNOWLEDGE_EMAILS_PER_DAY } from '../knowledge/email-marks';
import { runKnowledgeEmail, runReviewEmails } from '../knowledge/knowledge-emails';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { knowledgeKit, OWNER, page, PAGES, type Kit, type Who } from './knowledge-test-kit';

// The Knowledgebase Reviews emails (docs/specs/030-knowledgebase/verification.md "Reminders", ai-knowledge.md
// "Pages that disagree", "Knowledge Health"): who is emailed, how often, and what each route answers.

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 9);
const BOB = 'user_bob';
const TEAM = 'team1';
const EMAIL_ON = {
  ...ACCOUNTS_ON,
  EMAIL: { send: vi.fn(async () => ({ messageId: 'm' })) } as unknown as SendEmail,
  APP_BASE_URL: 'https://app.test',
};
const member = (userId: string): TeamPerson => ({
  id: `m-${userId}`,
  userId,
  email: `${userId}@x.test`,
  name: null,
  role: 'member',
  status: 'joined',
});

let kit: Kit;
let fake: FakeAccounts;
let clock: { mockReturnValue: (now: number) => unknown };

const sent = () =>
  vi.mocked(sendEmail).mock.calls.map(([, e]) => ({ to: e.to, kind: e.kind, subject: e.subject }));
const lastEmail = () =>
  vi.mocked(sendEmail).mock.calls.at(-1)![1] as { html: string; text: string };
const at = (now: number) => clock.mockReturnValue(now);
/** A page's stored fields, set as the room would hold them. */
const setFields = (tab: string, fields: object) =>
  kit.db.sql
    .prepare(
      `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = ?`,
    )
    .run(JSON.stringify(fields), tab);
/** A page verified `days` ago with the default 90 day interval. */
const verifiedDaysAgo = (tab: string, owner: string, days: number, now = T0) =>
  setFields(tab, { owner, verifiedAt: now - days * DAY, verifiedBy: owner });
const post = (who: Who, path: string) => kit.call(who, 'POST', `/api/documents/kb/${path}`);
const result = async (who: Who, path: string) =>
  await (await post(who, path)).json<KnowledgeEmailResult>();
const marks = (kind: string) =>
  kit.db.sql
    .prepare('SELECT key, at FROM knowledge_email_marks WHERE kind = ? ORDER BY key')
    .all(kind) as { key: string; at: number }[];

async function start(env: object = EMAIL_ON, pages: unknown[] = PAGES) {
  fake = stubAccounts();
  kit = await knowledgeKit(env, pages);
  kit.db.sql.prepare(`UPDATE document SET team_id = ? WHERE id = 'kb'`).run(TEAM);
  fake.teams.set(TEAM, [member(OWNER), member(BOB)]);
  fake.emails.set(OWNER, 'owner@x.test');
  fake.emails.set(BOB, 'bob@x.test');
  vi.mocked(sendEmail).mockClear();
}

beforeEach(async () => {
  clock = vi.spyOn(Date, 'now').mockReturnValue(T0);
  await start();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Review Due: the alarm’s check', () => {
  const run = (now = T0) => runReviewEmails(kit.db.env, 'kb', now);

  it('sends an owner one email listing every page of theirs that is due, once', async () => {
    verifiedDaysAgo('deploys', OWNER, 100);
    verifiedDaysAgo('rollbacks', OWNER, 91);
    verifiedDaysAgo('holidays', BOB, 10);
    // Nothing more is due until Bob's page is, in 80 days.
    expect(await run()).toBe(T0 + 80 * DAY);
    expect(sent()).toEqual([
      { to: 'owner@x.test', kind: 'ReviewDue', subject: 'Pages Due for Review in Handbook' },
    ]);
    const { html, text } = lastEmail();
    expect(html).toContain('https://app.test/document/kb#t=deploys');
    expect(html).toContain('https://app.test/document/kb#t=rollbacks');
    expect(html).not.toContain('#t=holidays');
    expect(text).toContain('- Deploys: https://app.test/document/kb#t=deploys');
    expect(text).toContain('https://app.test/explorer?settings=notifications');
    // The same pages are never told twice, at the next alarm or the day after.
    await run(T0 + 60_000);
    await run(T0 + 2 * DAY);
    expect(sent()).toHaveLength(1);
    expect(marks('review-page').map((m) => m.key)).toEqual(['deploys', 'rollbacks']);
  });

  it('holds a second email to an owner until a day has passed, then lists all their due pages', async () => {
    verifiedDaysAgo('deploys', OWNER, 100);
    await run();
    // Another page of theirs comes due an hour later.
    verifiedDaysAgo('rollbacks', OWNER, 90, T0 + 3_600_000);
    expect(await run(T0 + 3_600_000)).toBe(T0 + DAY);
    expect(sent()).toHaveLength(1);
    expect(await run(T0 + DAY)).toBeNull();
    expect(sent()).toHaveLength(2);
    expect(lastEmail().html).toContain('#t=deploys');
    expect(lastEmail().html).toContain('#t=rollbacks');
  });

  it('tells the owner again when a page is verified and comes due once more', async () => {
    verifiedDaysAgo('deploys', OWNER, 100);
    await run();
    const later = T0 + 200 * DAY;
    verifiedDaysAgo('deploys', OWNER, 95, later);
    await run(later);
    expect(sent()).toHaveLength(2);
  });

  it('sends nothing to an owner who turned Knowledgebase Reviews off, and does not ask again', async () => {
    fake.settings.set(OWNER, { all: {}, app: { notifyKnowledgeReviews: false } });
    verifiedDaysAgo('deploys', OWNER, 100);
    verifiedDaysAgo('holidays', BOB, 100);
    await run();
    expect(sent().map((e) => e.to)).toEqual(['bob@x.test']);
    expect(marks('review-owner').map((m) => m.key)).toEqual([BOB]);
    await run(T0 + 2 * DAY);
    expect(sent()).toHaveLength(1);
  });

  it('sends nothing to an owner who can no longer open the knowledgebase, or who is no account', async () => {
    verifiedDaysAgo('deploys', 'user_gone', 100);
    verifiedDaysAgo('holidays', 'guest_1', 100);
    fake.emails.set('user_gone', 'gone@x.test');
    await run();
    expect(sent()).toEqual([]);
  });

  it('does nothing where the deployment sends no email', async () => {
    await start({ ...ACCOUNTS_ON });
    verifiedDaysAgo('deploys', OWNER, 100);
    expect(await run()).toBeNull();
    expect(await runKnowledgeEmail(kit.db.env, 'kb', work('review-email'), T0)).toBeNull();
    expect(sent()).toEqual([]);
    expect(marks('review-page')).toEqual([]);
  });

  it('answers the next review to wait for when nothing is due, and nothing for no verified page', async () => {
    expect(await run()).toBeNull();
    verifiedDaysAgo('deploys', OWNER, 30);
    setFields('holidays', { owner: OWNER, verifiedAt: T0 - 5 * DAY, reviewEvery: 'never' });
    expect(await runKnowledgeEmail(kit.db.env, 'kb', work('review-email'), T0)).toBe(T0 + 60 * DAY);
    expect(sent()).toEqual([]);
  });

  it('sends one email for a knowledgebase of 500 due pages, short enough not to be clipped', async () => {
    const many = Array.from({ length: 500 }, (_, i) => page(`p${i}`, `Page ${i} <b>&`, []));
    await start(EMAIL_ON, many);
    for (const p of many) verifiedDaysAgo(p.id, OWNER, 100);
    const before = cpuNowMs();
    await run();
    const spent = cpuNowMs() - before;
    expect(sent()).toHaveLength(1);
    const { html } = lastEmail();
    expect(html).toContain('And 400 pages more.');
    // Gmail clips a message past 102 KB.
    expect(new TextEncoder().encode(html).length).toBeLessThan(102_000);
    expect(marks('review-page')).toHaveLength(500);
    expect(spent).toBeLessThan(cpuBudgetMs(1_500));
  });

  it('stops at 50 emails a knowledgebase a day and picks the rest up the next day', async () => {
    const owners = Array.from({ length: 60 }, (_, i) => `user_n${i}`);
    const many = owners.map((_, i) => page(`p${i}`, `Page ${i}`, []));
    await start(EMAIL_ON, many);
    fake.teams.set(TEAM, owners.map(member));
    owners.forEach((owner, i) => {
      fake.emails.set(owner, `${owner}@x.test`);
      verifiedDaysAgo(`p${i}`, owner, 100);
    });
    const tomorrow = (Math.floor(T0 / DAY) + 1) * DAY;
    expect(await run()).toBe(tomorrow);
    expect(sent()).toHaveLength(KNOWLEDGE_EMAILS_PER_DAY);
    // Later the same day: still held.
    await run(T0 + 3_600_000);
    expect(sent()).toHaveLength(50);
    await run(tomorrow);
    expect(sent()).toHaveLength(60);
    expect(new Set(sent().map((e) => e.to)).size).toBe(60);
  });
});

const work = (kind: 'review-email' | 'conflict') => ({ kind, key: 'daily', dueAt: 0, payload: '' });

describe('POST knowledge/remind-owners', () => {
  const remind = (who: Who = 'editor') => result(who, 'knowledge/remind-owners');

  it.each<[Who, number]>([
    ['editor', 200],
    ['participant', 403],
    ['viewer', 403],
    ['link', 403],
    ['agent', 403],
  ])('as %s answers %i', async (who, status) => {
    verifiedDaysAgo('deploys', OWNER, 100);
    expect((await post(who, 'knowledge/remind-owners')).status).toBe(status);
    expect(sent()).toHaveLength(status === 200 ? 1 : 0);
  });

  it('sends each owner one email of their due and never-verified pages, once a week', async () => {
    verifiedDaysAgo('deploys', OWNER, 100);
    setFields('rollbacks', { owner: OWNER });
    setFields('holidays', { owner: BOB });
    expect(await remind()).toEqual({ outcome: 'sent', sent: 2, owners: 2 });
    expect(sent()).toEqual([
      { to: 'owner@x.test', kind: 'OwnersReminded', subject: 'Pages to Review in Handbook' },
      { to: 'bob@x.test', kind: 'OwnersReminded', subject: 'Pages to Review in Handbook' },
    ]);
    const owner = vi.mocked(sendEmail).mock.calls[0]![1] as { html: string };
    expect(owner.html).toContain('#t=deploys');
    expect(owner.html).toContain('(Review Due)');
    expect(owner.html).toContain('(Never Verified)');
    expect(owner.html).not.toContain('#t=holidays');
    at(T0 + 6 * DAY);
    expect(await remind()).toEqual({ outcome: 'already_sent', sentAt: T0, nextAt: T0 + 7 * DAY });
    expect(sent()).toHaveLength(2);
    at(T0 + 7 * DAY);
    expect((await remind()).outcome).toBe('sent');
    expect(sent()).toHaveLength(4);
  });

  it('says why nothing was sent, and keeps the week for when something can be', async () => {
    verifiedDaysAgo('deploys', OWNER, 10);
    verifiedDaysAgo('rollbacks', OWNER, 10);
    verifiedDaysAgo('holidays', OWNER, 10);
    expect(await remind()).toEqual({ outcome: 'nothing_due' });
    setFields('holidays', {});
    expect(await remind()).toEqual({ outcome: 'no_owners' });
    setFields('holidays', { owner: OWNER });
    fake.settings.set(OWNER, { all: {}, app: { notifyKnowledgeReviews: false } });
    expect(await remind()).toEqual({ outcome: 'no_recipients' });
    expect(marks('remind')).toEqual([]);
    fake.settings.delete(OWNER);
    expect(await remind()).toEqual({ outcome: 'sent', sent: 1, owners: 1 });
  });

  it('answers unavailable where the deployment sends no email', async () => {
    await start({ ...ACCOUNTS_ON });
    setFields('holidays', { owner: OWNER });
    expect(await remind()).toEqual({ outcome: 'unavailable' });
    expect(sent()).toEqual([]);
  });

  it('shares the day’s ceiling with the other review emails', async () => {
    setFields('holidays', { owner: OWNER });
    kit.db.sql
      .prepare(`INSERT INTO usage_counters (scope, period, used) VALUES ('emails', ?, ?)`)
      .run(new Date(T0).toISOString().slice(0, 10), KNOWLEDGE_EMAILS_PER_DAY);
    expect(await remind()).toEqual({ outcome: 'daily_limit' });
    expect(sent()).toEqual([]);
    at(T0 + DAY);
    expect((await remind()).outcome).toBe('sent');
  });
});

describe('POST conflicts/<id>/ask-owners', () => {
  // Two passages of two pages, set against each other as the conflict check would leave them.
  const conflict = (id = 'c1') => {
    const passages = kit.db.sql
      .prepare(`SELECT id, tab, text_hash AS hash FROM passages WHERE ordinal >= 0 ORDER BY tab`)
      .all() as { id: string; tab: string; hash: string }[];
    const a = passages.find((p) => p.tab === 'deploys')!;
    const b = passages.find((p) => p.tab === 'holidays')!;
    kit.db.sql
      .prepare(
        `INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, state, found_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 1)`,
      )
      .run(id, 'When is the <office> closed?', a.id, a.tab, a.hash, b.id, b.tab, b.hash);
    return `conflicts/${id}/ask-owners`;
  };

  it.each<[Who, number]>([
    ['editor', 200],
    ['participant', 403],
    ['viewer', 403],
    ['agent', 403],
  ])('as %s answers %i', async (who, status) => {
    setFields('deploys', { owner: OWNER });
    expect((await post(who, conflict())).status).toBe(status);
    expect(sent()).toHaveLength(status === 200 ? 1 : 0);
  });

  it('emails each of the two owners once, naming both pages and passages, and never again', async () => {
    setFields('deploys', { owner: OWNER });
    setFields('holidays', { owner: BOB });
    const path = conflict();
    expect(await result('editor', path)).toEqual({ outcome: 'sent', sent: 2, owners: 2 });
    expect(sent()).toEqual([
      { to: 'owner@x.test', kind: 'PagesDisagree', subject: 'Two Pages Disagree in Handbook' },
      { to: 'bob@x.test', kind: 'PagesDisagree', subject: 'Two Pages Disagree in Handbook' },
    ]);
    const { html, text } = lastEmail();
    expect(html).toContain('https://app.test/document/kb#t=deploys');
    expect(html).toContain('https://app.test/document/kb#t=holidays');
    expect(html).toContain('https://app.test/document/kb?view=ai');
    expect(html).toContain('Everyone takes the last week of December off.');
    // The question is other people's text: escaped.
    expect(html).toContain('When is the &lt;office&gt; closed?');
    expect(html).not.toContain('<office>');
    expect(text).toContain('See both passages: https://app.test/document/kb?view=ai');
    at(T0 + 30 * DAY);
    expect(await result('editor', path)).toEqual({ outcome: 'already_sent', sentAt: T0 });
    expect(sent()).toHaveLength(2);
    const overview = await (
      await kit.call('editor', 'GET', '/api/documents/kb/knowledge')
    ).json<KnowledgeOverviewResponse>();
    expect(overview.conflicts[0]!.askedAt).toBe(T0);
  });

  it('sends one email when one person owns both pages, and says when nobody owns either', async () => {
    const path = conflict();
    expect(await result('editor', path)).toEqual({ outcome: 'no_owners' });
    setFields('deploys', { owner: BOB });
    setFields('holidays', { owner: BOB });
    expect(await result('editor', path)).toEqual({ outcome: 'sent', sent: 1, owners: 1 });
  });

  it('answers 404 for a conflict that is closed or unknown, and unavailable with email off', async () => {
    const gone = await post('editor', 'conflicts/nope/ask-owners');
    expect(gone.status).toBe(404);
    expect((await gone.json<{ error: string }>()).error).toBe('conflict_unknown');
    await start({ ...ACCOUNTS_ON });
    setFields('deploys', { owner: OWNER });
    expect(await result('editor', conflict())).toEqual({ outcome: 'unavailable' });
  });
});

describe('GET knowledge', () => {
  it('says whether review emails are sent here and when the owners were last reminded', async () => {
    const read = async () =>
      (
        await (
          await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')
        ).json<KnowledgeOverviewResponse>()
      ).reviewEmails;
    expect(await read()).toEqual({ available: true });
    setFields('holidays', { owner: OWNER });
    await post('editor', 'knowledge/remind-owners');
    expect(await read()).toEqual({ available: true, remindedAt: T0 });
    await start({ ...ACCOUNTS_ON });
    expect(await read()).toEqual({ available: false });
  });
});
