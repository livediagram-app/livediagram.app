import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_REVERTED_CLOSE } from '@liveknowledge/api-schema';
import { readGeneration } from '@liveworkspace/snapshots/server';
import type { Env } from '../../types';
import { RULE_TABS_MAX, TEMPLATE_GONE, tabLimitWords } from '@liveworkspace/automations/room';
import { VERSION_NAMED_MAX } from '@liveknowledge/api-schema';
import { box, DOC, roomWorld, type RoomWorld } from './test-automation-world';
import { VERSION_GONE, namesFullWords } from './kit-versions';

// A document's rules run end to end in its real room, on its alarm (docs/specs/013-workspace/automations.md; blueprint
// automations.md "The engine in the room", "The kit"): the time triggers, the shared steps through this app's kit
// (snapshots, tabs, email, AI), and the Incoming Webhook door. On node:sqlite here; the same paths run on workerd in
// test/workerd-automations.

const BASE = `/api/documents/${DOC}`;
const DAY = 24 * 60 * 60_000;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function started(extra: Partial<Env> = {}): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld(extra);
  await w.create([
    { id: 't1', name: 'Letter', elements: [box('a', 'Checkout')] },
    { id: 't2', name: 'Deck', elements: [box('n', 'Remember')] },
  ]);
  return w;
}

const later = (ms: number) => vi.useFakeTimers({ now: Date.now() + ms, toFake: ['Date'] });

// Run Rule, answered as how it ended and what each line of its run says.
async function runNow(w: RoomWorld, ruleId: string) {
  const res = await w.send('POST', `${BASE}/automations/${ruleId}/run`, {});
  const { run } = await res.json<{ run: { result: string; steps: { text: string }[] } }>();
  return { result: run.result, said: run.steps.map((s) => s.text) };
}

describe('a Scheduled rule', () => {
  it('wakes the document at its time with nobody in it, and runs once', async () => {
    const w = await started();
    const rule = await w.rule({
      trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
      steps: [{ kind: 'take_snapshot', name: 'Daily {{item.name}}' }],
    });
    const due = w.room.automations.schedule.wakeAt!;
    expect(due).toBeGreaterThan(Date.now());
    expect(due - Date.now()).toBeLessThanOrEqual(DAY);
    // Not yet: an early alarm runs nothing.
    await w.alarm();
    expect(w.runs()).toEqual([]);
    later(due - Date.now() + 1000);
    await w.alarm();
    expect(w.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(w.rows('SELECT name, author_name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'Daily Launch', author_name: rule.name },
    ]);
    // The next day's moment is set, and the same alarm again runs nothing more.
    expect(w.room.automations.schedule.wakeAt!).toBeGreaterThan(due);
    await w.alarm();
    expect(w.runs()).toHaveLength(1);
  });
});

describe('Revert to Snapshot', () => {
  it('is the ordinary revert: a safety snapshot, the content back, every session ended, the generation advanced', async () => {
    const w = await started();
    const snap = await w.send('POST', `${BASE}/snapshots`, { name: 'Clean board' });
    const { snapshot } = await snap.json<{ snapshot: { id: string } }>();
    const rule = await w.rule({
      name: 'Reset Every Night',
      trigger: { kind: 'manual' },
      steps: [{ kind: 'revert_snapshot', snapshot: snapshot.id, name: 'Clean board' }],
    });
    // The document moves on: a tab changed, a tab added.
    await w.saveTab('t1', [box('a', 'Scribbled over'), box('extra')]);
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'Scratch', elements: [] });
    // Rules that would hear the revert's rewrites, were they not silent.
    await w.rule({ trigger: { kind: 'tab_removed' } });
    await w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const before = await readGeneration(w.room.requireEnv().DOCUMENT_DB, DOC);
    const open = [w.connect('edit', 'Ana'), w.connect('view', 'Ben')];

    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('done');
    expect(ran.said).toContain('Reverted to “Clean board”');
    expect(w.rows('SELECT tab_id FROM document_tabs ORDER BY order_index')).toEqual([
      { tab_id: 't1' },
      { tab_id: 't2' },
    ]);
    expect(String(w.rows("SELECT data FROM tabs WHERE id = 't1'")[0]!['data'])).toContain(
      'Checkout',
    );
    // The safety snapshot, by Automation with the rule's name.
    expect(w.rows("SELECT name, author_name FROM snapshots WHERE kind = 'before-revert'")).toEqual([
      { name: 'Before reverting to "Clean board"', author_name: 'Reset Every Night' },
    ]);
    expect(await readGeneration(w.room.requireEnv().DOCUMENT_DB, DOC)).toBe(before + 1);
    for (const ws of open)
      expect(ws.closed).toEqual([SNAPSHOT_REVERTED_CLOSE, 'snapshot-reverted']);
    // Nothing of the revert reached the other rules.
    expect(w.queued()).toEqual([]);
    expect(w.rows('SELECT * FROM automation_settles')).toEqual([]);
  });

  it('fails the run when the snapshot is gone, and says so on the rule', async () => {
    const w = await started();
    const rule = await w.rule({
      steps: [{ kind: 'revert_snapshot', snapshot: 'gone', name: 'Old' }],
    });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('failed');
    expect(ran.said).toContain('The snapshot is gone');
  });
});

describe('Name This Version', () => {
  it('names the run’s tab as it stands, by Automation, and starts no Version Named rule unless it chains', async () => {
    const w = await started();
    await w.rule({ name: 'Hears names', trigger: { kind: 'version_named' } });
    const rule = await w.rule({
      name: 'Weekly Name',
      steps: [{ kind: 'name_version', tab: 't1', name: 'Week of {{now.date}}' }],
    });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('done');
    expect(ran.said.join('\n')).toMatch(/Named the current version of Letter “Week of /);
    const listed = await (
      await w.send('GET', `${BASE}/tabs/t1/versions`)
    ).json<{ versions: { name: string | null; author: { name: string } }[] }>();
    expect(listed.versions.filter((v) => v.name)).toMatchObject([
      { name: expect.stringMatching(/^Week of /), author: { name: 'Automation · Weekly Name' } },
    ]);
    await w.alarm();
    expect(w.runs().filter((r) => r['ruleName'] === 'Hears names')).toMatchObject([
      { result: 'skipped' },
    ]);
  });

  it(`fails at the cap of ${VERSION_NAMED_MAX} named versions`, async () => {
    const w = await started();
    for (let i = 0; i < VERSION_NAMED_MAX; i += 1) {
      await w.saveTab('t1', [box('a', `Draft ${i}`)]);
      expect((await w.send('POST', `${BASE}/tabs/t1/versions`, { name: `V${i}` })).status).toBe(
        201,
      );
    }
    await w.saveTab('t1', [box('a', 'One more')]);
    const rule = await w.rule({ steps: [{ kind: 'name_version', tab: 't1', name: 'Over' }] });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('failed');
    expect(ran.said).toContain(namesFullWords);
  });
});

describe('Restore a Version', () => {
  async function named(w: RoomWorld, name: string) {
    const res = await w.send('POST', `${BASE}/tabs/t1/versions`, { name });
    return (await res.json<{ version: { id: string } }>()).version.id;
  }

  it('restores the named version as the Restore route does, and steps may follow it', async () => {
    const w = await started();
    const version = await named(w, 'Signed off');
    await w.saveTab('t1', [box('a', 'Scribbled over')]);
    const rule = await w.rule({
      steps: [
        { kind: 'restore_version', tab: 't1', version },
        { kind: 'take_snapshot', name: 'After the restore' },
      ],
    });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('done');
    expect(ran.said).toContain('Restored Letter to “Signed off”');
    expect(String(w.rows("SELECT data FROM tabs WHERE id = 't1'")[0]!['data'])).toContain(
      'Checkout',
    );
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'After the restore' },
    ]);
    // A second run finds the tab already matching.
    expect((await runNow(w, rule.id)).said).toContain('Letter already matched “Signed off”');
  });

  it('fails with the version gone once it is unnamed, and lists the rule as needing it', async () => {
    const w = await started();
    const version = await named(w, 'Old');
    const rule = await w.rule({ steps: [{ kind: 'restore_version', tab: 't1', version }] });
    await w.send('PUT', `${BASE}/tabs/t1/versions/${version}/name`, { name: null });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('failed');
    expect(ran.said).toContain(VERSION_GONE);
    const list = await (
      await w.send('GET', `${BASE}/automations`)
    ).json<{ rules: { id: string; needs: string[] }[] }>();
    expect(list.rules.find((r) => r.id === rule.id)!.needs.join('\n')).toMatch(/version/i);
  });
});

describe('Add a Tab from a Template', () => {
  it('adds the tab as New Tab makes it, last in order, named by the rule, and tells the room', async () => {
    const w = await started();
    const rule = await w.rule({
      steps: [{ kind: 'add_tab', template: 'blank-article', name: 'Retro {{now.date}}' }],
    });
    const watcher = w.connect('edit', 'Ana');
    watcher.sent.length = 0;
    expect((await runNow(w, rule.id)).result).toBe('done');
    const tabs = w.rows(
      'SELECT t.id, t.name, t.element_count, dt.order_index FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id ORDER BY dt.order_index',
    );
    expect(tabs).toHaveLength(3);
    expect(String(tabs[2]!['name'])).toMatch(/^Retro \d{1,2} \w{3} \d{4}$/);
    expect(
      String(w.rows('SELECT data FROM tabs WHERE id = ?', String(tabs[2]!['id']))[0]!['data']),
    ).toContain('"pages"');
    // Everyone with the document open sees it arrive.
    expect(watcher.sent.join('\n')).toContain('document-meta');
  });

  it('starts a Tab Added rule by Automation only when the rule lets its changes start others', async () => {
    const w = await started();
    await w.rule({ name: 'Hears tabs', trigger: { kind: 'tab_added' } });
    const quiet = await w.rule({
      steps: [{ kind: 'add_tab', template: 'blank-article', name: 'Quiet' }],
    });
    await w.send('POST', `${BASE}/automations/${quiet.id}/run`, {});
    await w.alarm();
    // The rule keeps its changes to itself: the other rule's run is Skipped, and says why.
    expect(w.runs().filter((r) => r['ruleName'] === 'Hears tabs')).toMatchObject([
      { result: 'skipped' },
    ]);
    const loud = await w.rule({
      chain: true,
      steps: [{ kind: 'add_tab', template: 'blank-article', name: 'Loud' }],
    });
    await w.send('POST', `${BASE}/automations/${loud.id}/run`, {});
    await w.alarm();
    expect(
      w
        .runs()
        .filter((r) => r['ruleName'] === 'Hears tabs')
        .map((r) => r['result'])
        .sort(),
    ).toEqual(['done', 'skipped']);
  });

  it('fails the step at the page limit, and for a template that is gone', async () => {
    const w = await started();
    const gone = await w.rule({ steps: [{ kind: 'add_tab', template: 'no-such', name: 'X' }] });
    expect(await runNow(w, gone.id)).toMatchObject({ result: 'failed' });
    expect((await runNow(w, gone.id)).said).toContain(TEMPLATE_GONE);
    const now = Date.now();
    for (let i = 0; i < RULE_TABS_MAX; i += 1) {
      w.db
        .prepare(
          'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, 0, 1)',
        )
        .run(`x${i}`, `X ${i}`, '{"elements":[]}', now);
      w.db
        .prepare(
          'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
        )
        .run(DOC, `x${i}`, 10 + i, now);
    }
    const full = await w.rule({
      steps: [{ kind: 'add_tab', template: 'blank-article', name: 'One more' }],
    });
    const refused = await runNow(w, full.id);
    expect(refused.result).toBe('failed');
    expect(refused.said).toContain(tabLimitWords('knowledgebase'));
    expect(tabLimitWords('knowledgebase')).toContain('200 pages');
    expect(w.rows('SELECT COUNT(*) AS n FROM document_tabs')[0]!['n']).toBe(RULE_TABS_MAX + 2);
  });
});

describe('Incoming Webhook', () => {
  async function hooked(w: RoomWorld) {
    const rule = await w.rule({
      trigger: { kind: 'incoming_webhook' },
      steps: [{ kind: 'take_snapshot', name: 'Before {{webhook.version}}' }],
    });
    const made = await w.send('POST', `${BASE}/automations/${rule.id}/secret`);
    const { secret } = await made.json<{ secret: string }>();
    return { rule, secret };
  }
  const bytes = (body: unknown) => new TextEncoder().encode(JSON.stringify(body));

  it('takes a call that proves the secret, by Bearer or by signature, and runs the rule', async () => {
    const w = await started();
    const { rule, secret } = await hooked(w);
    const body = bytes({ version: '2.4', tab: 'Letter' });
    // Signed as a sender signs: the timestamp, a dot and the exact body.
    const ts = String(Math.floor(Date.now() / 1000));
    const signed = await w.room.incomingHook(DOC, rule.id, {
      body,
      authorization: null,
      signature: `sha256=${createHmac('sha256', secret).update(`${ts}.`).update(body).digest('hex')}`,
      timestamp: ts,
    });
    expect(signed).toMatchObject({ status: 202, body: { queued: 1 } });
    const bearer = await w.room.incomingHook(DOC, rule.id, {
      body: bytes({ version: '2.5' }),
      authorization: `Bearer ${secret}`,
      signature: null,
    });
    expect(bearer).toMatchObject({ status: 202, body: { queued: 1 } });
    await w.alarm();
    expect(w.runs()).toMatchObject([{ result: 'done' }, { result: 'done' }]);
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ? ORDER BY name', DOC)).toEqual([
      { name: 'Before 2.4' },
      { name: 'Before 2.5' },
    ]);
  });

  it('answers every wrong proof the same 401, and queues nothing', async () => {
    const w = await started();
    const { rule, secret } = await hooked(w);
    const body = bytes({ version: '1' });
    const wrong = [
      { body, authorization: 'Bearer lwh_wrong', signature: null },
      { body, authorization: null, signature: 'sha256=00ff' },
      // A good signature of another body.
      {
        body,
        authorization: null,
        signature: `sha256=${createHmac('sha256', secret).update('{}').digest('hex')}`,
      },
      { body, authorization: null, signature: null },
    ];
    for (const call of wrong)
      expect(await w.room.incomingHook(DOC, rule.id, call)).toMatchObject({
        status: 401,
        body: { error: 'webhook_unauthorized' },
      });
    // An unknown rule, and a document never started, answer as a wrong secret does.
    const good = { body, authorization: `Bearer ${secret}`, signature: null };
    expect(await w.room.incomingHook(DOC, 'nope', good)).toMatchObject({ status: 401 });
    const empty = roomWorld({}, 'doc-2');
    expect(await empty.room.incomingHook('doc-2', rule.id, good)).toMatchObject({ status: 401 });
    expect(empty.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([]);
    expect(w.queued()).toEqual([]);
  });

  it('takes the call and runs nothing while the document is put away', async () => {
    const w = await started();
    const { rule, secret } = await hooked(w);
    await w.room.takeStanding(DOC, { archived: true, trashed: false, at: Date.now() });
    const answer = await w.room.incomingHook(DOC, rule.id, {
      body: bytes({}),
      authorization: `Bearer ${secret}`,
      signature: null,
    });
    expect(answer).toMatchObject({ status: 202, body: { queued: 0 } });
    expect(w.queued()).toEqual([]);
  });
});

describe('Send Email', () => {
  const mailbox = () => {
    const sent: { to: string; subject: string; html: string; headers?: Record<string, string> }[] =
      [];
    const EMAIL = {
      send: async (message: { to: string; subject: string; html: string }) => {
        sent.push(message);
        return { messageId: 'm' };
      },
    };
    return { sent, env: { EMAIL } as unknown as Partial<Env> };
  };

  it('says email is not set up without the binding', async () => {
    const w = await started();
    const rule = await w.rule({
      steps: [{ kind: 'email', to: { owner: true }, subject: 'Hi', body: 'There' }],
    });
    const ran = await runNow(w, rule.id);
    expect(ran.result).toBe('failed');
    expect(ran.said).toContain("Email isn't set up here");
  });

  it('emails a typed-in address with the rule’s words, the fixed words and its own unsubscribe link, which works once', async () => {
    const { sent, env } = mailbox();
    const w = await started(env);
    const rule = await w.rule({
      name: 'Weekly Note',
      steps: [
        {
          kind: 'email',
          to: { addresses: ['pat@example.com'] },
          subject: 'News from {{item.name}}',
          body: 'Line one\n<b>Line two</b>',
        },
      ],
    });
    expect((await runNow(w, rule.id)).result).toBe('done');
    await w.settled();
    expect(sent).toHaveLength(1);
    const mail = sent[0]!;
    expect(mail.to).toBe('pat@example.com');
    expect(mail.subject).toBe('News from Launch');
    expect(mail.html).toContain('Line one<br>&lt;b&gt;Line two&lt;/b&gt;');
    expect(mail.html).toContain('Weekly Note');
    const page = /email-optout\?d=doc-1&amp;t=([A-Za-z0-9_-]+)/.exec(mail.html);
    expect(page).not.toBeNull();
    // The door unsubscribes the address; the next run emails nobody.
    expect(await w.room.emailOptOut(DOC, page![1]!)).toBe(true);
    expect(await w.room.emailOptOut(DOC, 'not-a-token')).toBe(false);
    expect((await runNow(w, rule.id)).said.join('\n')).toContain('unsubscribed');
    await w.settled();
    expect(sent).toHaveLength(1);
  });

  it('emails no person without a verified address to send to', async () => {
    const { sent, env } = mailbox();
    const w = await started(env);
    const rule = await w.rule({
      steps: [{ kind: 'email', to: { owner: true }, subject: 'Hi', body: 'There' }],
    });
    // No accounts Worker here, so nobody's address is known.
    expect((await runNow(w, rule.id)).result).toBe('failed');
    expect(sent).toEqual([]);
  });
});

describe('Summarise with AI', () => {
  it('says AI is not set up without the binding', async () => {
    const w = await started();
    const rule = await w.rule({ steps: [{ kind: 'ai', task: 'summarise' }] });
    expect((await runNow(w, rule.id)).said.join('\n')).toContain("AI isn't set up here");
  });

  it('sends the document’s outline, each tab under its name, and keeps the summary for the steps after', async () => {
    const asked: string[] = [];
    const AI = {
      run: async (_model: string, input: { messages: { content: string }[] }) => {
        asked.push(input.messages.map((m) => m.content).join('\n'));
        return { response: JSON.stringify({ summary: 'Checkout and notes.' }) };
      },
    };
    const w = await started({ AI });
    // An article reads as its Markdown.
    await w.send('PUT', `${BASE}/tabs/t3`, { id: 't3', name: 'Brief', elements: [] });
    await w.send(
      'POST',
      `${BASE}/tabs/t3/pages`,
      { article: { markdown: '# Remember\n\n- The launch list' } },
      { token: { name: 'Writer' } },
    );
    const rule = await w.rule({
      steps: [
        { kind: 'ai', task: 'summarise' },
        { kind: 'take_snapshot', name: '{{summary}}' },
      ],
    });
    const ran = await runNow(w, rule.id);
    expect(ran, ran.said.join(' | ')).toMatchObject({ result: 'done' });
    expect(asked).toHaveLength(1);
    for (const said of [
      '# Letter',
      'Checkout',
      '# Deck',
      'Remember',
      '# Brief',
      '- The launch list',
    ])
      expect(asked[0]).toContain(said);
    // Words only: no layouts list, no note on coordinates.
    expect(asked[0]).not.toContain('layouts ');
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([
      { name: 'Checkout and notes.' },
    ]);
  });
});
