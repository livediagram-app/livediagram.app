import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANA,
  BEN,
  DOC,
  roomWorld,
  type RoomWorld,
  type Who,
} from '../document-room/automations/test-automation-world';

// Who may do what with a document's Automations (docs/specs/013-workspace/automations.md "Share roles";
// docs/instructions/gate-a-feature-by-share-role.md): the routes are the engine's, the caller is this app's, so each
// role is driven through the document's own gates, in its real room.

const BASE = `/api/documents/${DOC}/automations`;

const RULE = {
  name: 'Friday Snapshot',
  trigger: { kind: 'manual' },
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Week of {{now.date}}' }],
  chain: false,
  timeZone: 'UTC',
};

const errorOf = async (res: Response) => (await res.json<{ error?: string }>()).error;

afterEach(() => vi.restoreAllMocks());

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([
    { id: 't1', name: 'Letter', elements: [] },
    { id: 't2', name: 'Deck', elements: [] },
  ]);
  return w;
}

describe('an Editor of the whole document, signed in', () => {
  it('lists, makes, saves, toggles, duplicates, orders, tests, runs and deletes rules, and reads the Audit Trail', async () => {
    const w = await started();
    const made = await w.send('POST', BASE, RULE);
    expect(made.status).toBe(201);
    const { rule } = await made.json<{
      rule: { id: string; enabled: boolean; made: unknown };
    }>();
    expect(rule.enabled).toBe(true);
    expect(rule.made).toMatchObject({ by: { id: ANA } });

    const list = await w.send('GET', BASE);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ rules: [{ id: rule.id }], runsToday: 0 });

    const saved = await w.send('PUT', `${BASE}/${rule.id}`, { ...RULE, name: 'Renamed' });
    expect(saved.status).toBe(200);

    const off = await w.send('POST', `${BASE}/${rule.id}/toggle`, { enabled: false });
    expect(off.status).toBe(200);
    expect((await off.json<{ rule: { enabled: boolean } }>()).rule.enabled).toBe(false);
    expect((await w.send('POST', `${BASE}/${rule.id}/toggle`, { enabled: true })).status).toBe(200);

    const copy = await w.send('POST', `${BASE}/${rule.id}/duplicate`);
    expect(copy.status).toBe(201);
    const copied = (await copy.json<{ rule: { id: string } }>()).rule.id;

    expect((await w.send('POST', `${BASE}/order`, { ids: [copied, rule.id] })).status).toBe(204);

    const tested = await w.send('POST', `${BASE}/test`, { rule: RULE });
    expect(tested.status).toBe(200);
    expect(JSON.stringify(await tested.json())).toContain('Would take a snapshot');
    // A test changes nothing.
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toEqual([]);

    const ran = await w.send('POST', `${BASE}/${rule.id}/run`, {});
    expect(ran.status).toBe(200);
    expect(await ran.json()).toMatchObject({ run: { result: 'done' } });
    expect(w.rows('SELECT name FROM snapshots WHERE item_id = ?', DOC)).toHaveLength(1);

    const runs = await w.send('GET', `${BASE}/runs`);
    expect(runs.status).toBe(200);
    expect((await runs.json<{ runs: unknown[] }>()).runs).toHaveLength(1);

    expect((await w.send('DELETE', `${BASE}/${copied}`)).status).toBe(204);
    expect((await w.send('GET', `${BASE}/nope/unknown`)).status).toBe(404);
  });

  it('makes an Incoming Webhook rule its secret, shown once', async () => {
    const w = await started();
    const rule = await w.rule({ trigger: { kind: 'incoming_webhook' } });
    const made = await w.send('POST', `${BASE}/${rule.id}/secret`);
    expect(made.status).toBe(201);
    const body = await made.json<{ secret: string; hook: { url: string } }>();
    expect(body.secret).toMatch(/^lwh_/);
    expect(body.hook.url).toBe(
      `https://www.liveknowledge.app/api/hooks/automations/${DOC}/${rule.id}`,
    );
    // Never stored: the list shows its last four characters only.
    expect(JSON.stringify(await (await w.send('GET', BASE)).json())).not.toContain(body.secret);
  });

  it('saves a rule that reverts to a snapshot', async () => {
    const w = await started();
    const res = await w.send('POST', BASE, {
      ...RULE,
      steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1', name: 'Clean' }],
    });
    expect(res.status).toBe(201);
  });
});

describe('everyone else is refused', () => {
  const REFUSED: [string, Who][] = [
    ['an Editor through a link to one tab', { id: BEN, level: 'edit', tab: 't1' }],
    ['a Participant', { id: BEN, level: 'participate' }],
    ['a Viewer', { id: BEN, level: 'view' }],
    ['a guest on an Editor link', { id: 'guest_1', guest: true, level: 'edit' }],
    ['a link visitor with no identity', { id: null, level: 'edit' }],
    ['someone with no grant', { id: BEN, stranger: true }],
  ];

  it.each(REFUSED)('%s gets 403 automations_need_editor on every route', async (_name, who) => {
    const w = await started();
    const rule = await w.rule({});
    const calls: [string, string, unknown?][] = [
      ['GET', BASE],
      ['POST', BASE, RULE],
      ['PUT', `${BASE}/${rule.id}`, RULE],
      ['DELETE', `${BASE}/${rule.id}`],
      ['POST', `${BASE}/${rule.id}/toggle`, { enabled: false }],
      ['POST', `${BASE}/${rule.id}/duplicate`],
      ['POST', `${BASE}/${rule.id}/run`, {}],
      ['POST', `${BASE}/${rule.id}/secret`],
      ['POST', `${BASE}/order`, { ids: [rule.id] }],
      ['POST', `${BASE}/test`, { rule: RULE }],
      ['POST', `${BASE}/draft`, { prompt: 'snapshot every Friday', timeZone: 'UTC' }],
      ['GET', `${BASE}/runs`],
    ];
    for (const [method, path, body] of calls) {
      const res = await w.send(method, path, body, who);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(await errorOf(res), `${method} ${path}`).toBe('automations_need_editor');
    }
    // Nothing changed.
    expect(w.rows('SELECT id, enabled FROM automation_rules')).toEqual([
      { id: rule.id, enabled: 1 },
    ]);
  });
});

describe('an API token of an Editor', () => {
  const TOKEN: Who = { token: { name: 'Robot' } };

  it('lists, adds, changes, tests and runs rules', async () => {
    const w = await started();
    const made = await w.send('POST', BASE, RULE, TOKEN);
    expect(made.status).toBe(201);
    const { rule } = await made.json<{ rule: { id: string; made: { ai?: boolean } } }>();
    // A rule an agent made says so.
    expect(rule.made.ai).toBe(true);
    expect((await w.send('GET', BASE, undefined, TOKEN)).status).toBe(200);
    expect((await w.send('POST', `${BASE}/test`, { rule: RULE }, TOKEN)).status).toBe(200);
    expect((await w.send('POST', `${BASE}/${rule.id}/run`, {}, TOKEN)).status).toBe(200);
  });

  it('cannot make a secret', async () => {
    const w = await started();
    const rule = await w.rule({ trigger: { kind: 'incoming_webhook' } });
    const res = await w.send('POST', `${BASE}/${rule.id}/secret`, undefined, TOKEN);
    expect(res.status).toBe(403);
    expect(w.rows('SELECT rule_id FROM automation_hooks')).toEqual([]);
  });

  it('cannot save or duplicate a rule holding Revert to Snapshot', async () => {
    const w = await started();
    const revert = { ...RULE, steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1' }] };
    const made = await w.send('POST', BASE, revert, TOKEN);
    expect(made.status).toBe(403);
    expect(await errorOf(made)).toBe('automation_needs_a_person');
    const held = await w.rule({ steps: revert.steps });
    const saved = await w.send('PUT', `${BASE}/${held.id}`, revert, TOKEN);
    expect(await errorOf(saved)).toBe('automation_needs_a_person');
    const copied = await w.send('POST', `${BASE}/${held.id}/duplicate`, undefined, TOKEN);
    expect(await errorOf(copied)).toBe('automation_needs_a_person');
  });

  it('only reads when it is read-only', async () => {
    const w = await started();
    const rule = await w.rule({});
    const readOnly: Who = { token: { readOnly: true } };
    expect((await w.send('GET', BASE, undefined, readOnly)).status).toBe(200);
    expect((await w.send('GET', `${BASE}/runs`, undefined, readOnly)).status).toBe(200);
    for (const [method, path, body] of [
      ['POST', BASE, RULE],
      ['PUT', `${BASE}/${rule.id}`, RULE],
      ['DELETE', `${BASE}/${rule.id}`],
      ['POST', `${BASE}/${rule.id}/toggle`, { enabled: false }],
      ['POST', `${BASE}/${rule.id}/run`, {}],
      ['POST', `${BASE}/test`, { rule: RULE }],
    ] as const) {
      const res = await w.send(method, path, body, readOnly);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(await errorOf(res)).toBe('read_only_token');
    }
  });

  // liveknowledge's scopes (docs/specs/024-agents/knowledgebase-for-agents.md "Scopes"): a token an Editor has not
  // granted `write` here reads the rules and changes none, and is told which scope to ask for.
  it('reads but changes nothing below the write scope, and says it needs write', async () => {
    const w = await started();
    const rule = await w.rule({});
    w.grant('read suggest');
    expect((await w.send('GET', BASE, undefined, TOKEN)).status).toBe(200);
    expect((await w.send('GET', `${BASE}/runs`, undefined, TOKEN)).status).toBe(200);
    for (const [method, path, body] of [
      ['POST', BASE, RULE],
      ['PUT', `${BASE}/${rule.id}`, RULE],
      ['POST', `${BASE}/${rule.id}/run`, {}],
    ] as const) {
      const res = await w.send(method, path, body, TOKEN);
      expect(res.status, `${method} ${path}`).toBe(403);
      const refusal = await res.json<{ error: string; needs: string; message: string }>();
      expect(refusal).toMatchObject({ error: 'scope_needed', needs: 'write' });
      expect(refusal.message).toContain('rules');
    }
  });

  it('is refused whatever it holds when its person is a Participant', async () => {
    const w = await started();
    const participant: Who = { id: BEN, level: 'participate', token: { name: 'Robot' } };
    const res = await w.send('GET', BASE, undefined, participant);
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('automations_need_editor');
  });
});

describe("a rule's summary", () => {
  it('is readable by anyone who may read the document, and shows no address, connection or AI ask', async () => {
    const w = await started();
    const rule = await w.rule({
      name: 'Tell People',
      trigger: { kind: 'manual' },
      steps: [
        { kind: 'ai', task: 'summarise' },
        {
          kind: 'email',
          to: { addresses: ['secret.person@example.com'] },
          subject: 'Hello {{summary}}',
          body: 'Private words',
        },
        { kind: 'notify', via: 'slack', webhook: 'wh_private', name: 'Launch Channel', text: 'Hi' },
      ],
    });
    const readers: Who[] = [
      { id: BEN, level: 'view' },
      { id: BEN, level: 'participate' },
      { id: BEN, level: 'edit', tab: 't1' },
      { id: 'guest_1', guest: true, level: 'view' },
      { token: { readOnly: true } },
    ];
    for (const who of readers) {
      const res = await w.send('GET', `${BASE}/summary?rule=${rule.id}`, undefined, who);
      expect(res.status).toBe(200);
      const text = JSON.stringify(await res.json());
      expect(text).toContain('Tell People');
      for (const hidden of [
        'secret.person@example.com',
        'Private words',
        'wh_private',
        'Launch Channel',
        'Hello',
      ])
        expect(text, hidden).not.toContain(hidden);
    }
    const byName = await w.send('GET', `${BASE}/summary?name=tell%20people`, undefined, readers[0]);
    expect(byName.status).toBe(200);
  });

  it('is refused to someone with no grant, and a rule that is gone is 404', async () => {
    const w = await started();
    const rule = await w.rule({});
    const stranger = await w.send('GET', `${BASE}/summary?rule=${rule.id}`, undefined, {
      id: BEN,
      stranger: true,
    });
    expect(stranger.status).not.toBe(200);
    const gone = await w.send('GET', `${BASE}/summary?rule=nope`, undefined, {
      id: BEN,
      level: 'view',
    });
    expect(gone.status).toBe(404);
    expect(await errorOf(gone)).toBe('automation_not_found');
  });
});

describe('the paths', () => {
  it('answers 404 for a document never started, and for a path that is none of its routes', async () => {
    const w = roomWorld();
    expect((await w.send('GET', BASE)).status).toBe(404);
    const s = await started();
    expect((await s.send('GET', `${BASE}/a/b`)).status).toBe(404);
    expect((await s.send('GET', `${BASE}/a/toggle/more`)).status).toBe(404);
    expect((await s.send('PATCH', BASE)).status).toBe(405);
  });
});
