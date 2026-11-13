import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_ADDRESS_EMAILS_PER_DAY } from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld, type Caller } from './test-automation-world';
import { ADDRESS_COUNT_UNREAD } from './automation-writes';

// Send Email to typed-in addresses (docs/specs/026-plan/automations.md "Typed-in addresses"): an Editor's to add,
// 1 to 10 checked addresses, each email with a one-click unsubscribe, at most 50 a plan a UTC day, a count that will
// not read sending nothing.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);
type Sent = {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
  oneClick?: boolean;
};
const sent = vi.hoisted(() => [] as Sent[]);
vi.mock('../../email/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../email/client')>()),
  emailEnabled: () => true,
  sendEmail: async (_env: unknown, msg: Sent) => {
    sent.push(msg);
    return { sent: true };
  },
}));

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  sent.length = 0;
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const settle = () => new Promise((r) => setTimeout(r, 10));
const db = () => w.plans.get('A')!.db;

const emailStep = (addresses: unknown) => ({
  kind: 'email',
  to: { addresses },
  subject: 'Done: {{card.title}}',
  body: 'Shipped',
});

// One card moved to Done, the rule's run settled, and what it logged.
async function moveOne(title = 'Ship it') {
  const c = await w.make('A', { title });
  await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
  await w.plans.get('A')!.room.alarm();
  await settle();
  const { runs } = await (
    await w.call('GET', '/runs')
  ).json<{
    runs: { result: string; reason?: string; steps: { ok?: boolean; text: string }[] }[];
  }>();
  return runs[0]!;
}

const today = () => Math.floor(Date.now() / 86_400_000) * 86_400_000;
const setSentToday = (n: number | string) =>
  db()
    .prepare(
      `INSERT INTO automation_email_days (day, sent) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET sent = excluded.sent`,
    )
    .run(today(), n);
const tokenOf = (msg: Sent) => msg.unsubscribeUrl!.split('/').pop()!;

describe('saving a rule that emails typed-in addresses', () => {
  it('keeps the addresses checked, lower case and once each', async () => {
    const rule = await w.rule({
      steps: [emailStep([' Ana@Example.com', 'ana@example.com', 'bo@example.org'])] as never,
    });
    expect(rule.steps[0]).toMatchObject({
      to: { addresses: ['ana@example.com', 'bo@example.org'] },
    });
  });

  it.each([
    ['no address', [], 'steps.0.to.addresses'],
    [
      'an 11th address',
      Array.from({ length: 11 }, (_, i) => `p${i}@example.com`),
      'steps.0.to.addresses',
    ],
    ['a bad address', ['ana@example.com', 'ana at example'], 'steps.0.to.addresses.1'],
  ])('refuses %s, naming where', async (_what, addresses, path) => {
    const res = await w.call('POST', '', {
      name: 'Tell them',
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: [emailStep(addresses)],
      chain: false,
      timeZone: 'Europe/London',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ path });
  });

  // Spec "Who may do what": only a signed-in Editor of the whole plan, in person or through their token.
  const body = {
    name: 'Tell them',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [emailStep(['ana@example.com'])],
    chain: false,
    timeZone: 'Europe/London',
  };
  it.each<Caller>(['owner', 'team', 'token'])(
    'lets a signed-in Editor (%s) add them',
    async (who) => {
      expect((await w.call('POST', '', body, who)).status).toBe(201);
    },
  );

  it.each<Caller>([
    'participant',
    'viewer',
    'guest',
    'tab_editor_link',
    'token_participant',
    'token_read_only',
    'workbench',
  ])('refuses %s', async (who) => {
    const res = await w.call('POST', '', body, who);
    expect(res.status).toBe(403);
  });

  it('refuses a link visitor with no account before anything is read', async () => {
    expect((await w.call('POST', '', body, 'link_visitor')).status).toBe(400);
    expect((await (await w.call('GET', '')).json<{ rules: unknown[] }>()).rules).toEqual([]);
  });

  it('refuses a Participant changing a rule to email addresses', async () => {
    const rule = await w.rule({ steps: [{ kind: 'flag' }] });
    const res = await w.call(
      'PUT',
      `/${rule.id}`,
      { ...body, steps: [emailStep(['ana@example.com'])] },
      'participant',
    );
    expect(res.status).toBe(403);
    expect(sent).toHaveLength(0);
  });
});

describe('emailing typed-in addresses', () => {
  it('emails each address with the fixed words and a one-click unsubscribe, never the rule’s sender', async () => {
    await w.rule({
      name: 'Tell them',
      steps: [emailStep(['ana@example.com', 'bo@example.org'])] as never,
    });
    const run = await moveOne();
    expect(run.result).toBe('done');
    expect(run.steps.map((s) => s.text)).toContain('Send Email to ana@example.com and 1 more');
    expect(sent.map((m) => m.to)).toEqual(['ana@example.com', 'bo@example.org']);
    const [first] = sent;
    expect(first!.subject).toBe('Done: Ship it');
    expect(first!.html).toContain('Sent by the rule <strong>Tell them</strong> in the plan');
    expect(first!.html).toContain('added your address to the rule');
    expect(first!.html).toContain('/email-optout?p=A&amp;t=');
    expect(first!.oneClick).toBe(true);
    expect(first!.unsubscribeUrl).toMatch(/\/api\/email-optout\/A\/[A-Za-z0-9_-]{43}$/);
    expect(first).not.toHaveProperty('from');
    // Each address its own token, kept for its next email.
    expect(tokenOf(sent[0]!)).not.toBe(tokenOf(sent[1]!));
    sent.length = 0;
    await moveOne('Again');
    expect(tokenOf(sent[0]!)).toBe(tokenOf(first!));
  });

  it('counts each address against the day', async () => {
    await w.rule({ steps: [emailStep(['ana@example.com', 'bo@example.org'])] as never });
    await moveOne();
    const row = db().prepare('SELECT sent FROM automation_email_days WHERE day = ?').get(today());
    expect(row).toEqual({ sent: 2 });
  });

  it('sends the last email the day allows, at the limit', async () => {
    setSentToday(AUTOMATION_ADDRESS_EMAILS_PER_DAY - 1);
    await w.rule({ steps: [emailStep(['ana@example.com'])] as never });
    const run = await moveOne();
    expect(run.result).toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('past the limit, sends none and the run is Skipped, saying why', async () => {
    setSentToday(AUTOMATION_ADDRESS_EMAILS_PER_DAY);
    await w.rule({ steps: [{ kind: 'flag' }, emailStep(['ana@example.com'])] as never });
    const run = await moveOne();
    expect(sent).toHaveLength(0);
    expect(run.result).toBe('skipped');
    expect(run.reason).toBe(
      "Not emailed: the plan's 50 emails a day to typed-in addresses are spent",
    );
    expect(run.steps.at(-1)).toMatchObject({ ok: false, text: run.reason });
    // The steps before it still landed.
    expect(
      (await w.items('A')).find((i) => i.fields['title'] === 'Ship it')?.fields['flagged'],
    ).toBe(true);
  });

  it('near the limit, sends what fits and says how many went', async () => {
    setSentToday(AUTOMATION_ADDRESS_EMAILS_PER_DAY - 2);
    await w.rule({
      steps: [emailStep(['a@example.com', 'b@example.com', 'c@example.com'])] as never,
    });
    const run = await moveOne();
    expect(sent.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com']);
    expect(run.result).toBe('skipped');
    expect(run.reason).toBe(
      "Emailed 2 of 3 addresses: the plan's 50 emails a day to typed-in addresses are spent",
    );
  });

  it('sends nothing when the day’s count will not read: a fault never lifts the limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setSentToday('not a number');
    await w.rule({ steps: [emailStep(['ana@example.com'])] as never });
    const run = await moveOne();
    expect(sent).toHaveLength(0);
    expect(run.result).toBe('skipped');
    expect(run.reason).toBe(ADDRESS_COUNT_UNREAD);
  });

  it('a new day starts a new count', async () => {
    db()
      .prepare('INSERT INTO automation_email_days (day, sent) VALUES (?, ?)')
      .run(today() - 86_400_000, AUTOMATION_ADDRESS_EMAILS_PER_DAY);
    await w.rule({ steps: [emailStep(['ana@example.com'])] as never });
    expect((await moveOne()).result).toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('Test on a Card sends nothing and counts nothing', async () => {
    const rule = await w.rule({ steps: [emailStep(['ana@example.com'])] as never });
    const c = await w.make('A', { title: 'Try' });
    const res = await w.call('POST', '/test', { rule, item: c.id, ruleId: rule.id });
    expect(res.status).toBe(200);
    await settle();
    expect(sent).toHaveLength(0);
    expect(db().prepare('SELECT * FROM automation_email_days').all()).toEqual([]);
  });
});

describe('unsubscribing', () => {
  async function unsubscribeFirst() {
    await w.rule({ steps: [emailStep(['ana@example.com', 'bo@example.org'])] as never });
    await moveOne();
    const token = tokenOf(sent.find((m) => m.to === 'ana@example.com')!);
    sent.length = 0;
    return token;
  }

  it('the one-click POST stops that address, and the others still get theirs', async () => {
    const token = await unsubscribeFirst();
    const res = await w.raw(
      new Request(`https://api.test/api/email-optout/A/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unsubscribed: true });
    const run = await moveOne('Again');
    expect(sent.map((m) => m.to)).toEqual(['bo@example.org']);
    expect(run.result).toBe('done');
    expect(run.steps.map((s) => s.text)).toContain('Not emailed: ana@example.com unsubscribed');
    // An unsubscribed address costs the day nothing.
    expect(
      db().prepare('SELECT sent FROM automation_email_days WHERE day = ?').get(today()),
    ).toEqual({
      sent: 3,
    });
  });

  it('a GET unsubscribes nobody (a link scanner opening it), and a wrong token is a 404', async () => {
    const token = await unsubscribeFirst();
    const get = await w.raw(new Request(`https://api.test/api/email-optout/A/${token}`));
    expect(get.status).toBe(405);
    const wrong = await w.raw(
      new Request(`https://api.test/api/email-optout/A/${'x'.repeat(43)}`, { method: 'POST' }),
    );
    expect(wrong.status).toBe(404);
    const short = await w.raw(
      new Request('https://api.test/api/email-optout/A/short', { method: 'POST' }),
    );
    expect(short.status).toBe(404);
    await moveOne('Again');
    expect(sent.map((m) => m.to)).toEqual(['ana@example.com', 'bo@example.org']);
  });

  it('a token answers only in its own plan', async () => {
    const token = await unsubscribeFirst();
    const res = await w.raw(
      new Request(`https://api.test/api/email-optout/B/${token}`, { method: 'POST' }),
    );
    expect(res.status).toBe(404);
  });
});
