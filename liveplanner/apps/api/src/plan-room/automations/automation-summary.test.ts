import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule } from '@liveplanner/items';
import type { AutomationSummaryResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../test-repeat-world';
import {
  automationWorld,
  ruleBody,
  type AutomationWorld,
  type Caller,
} from './test-automation-world';

// A rule's read-only summary (docs/specs/026-plan/automations.md "On cards", "Who may do what"): the one Automations
// route open to whoever may read the plan, answered from an allow-list, end to end through the real worker and room.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const summary = (query: string, who: Caller) => w.call('GET', `/summary?${query}`, undefined, who);
const read = async (query: string, who: Caller) => {
  const res = await summary(query, who);
  expect(res.status).toBe(200);
  return (await res.json<AutomationSummaryResponse>()).rule;
};

// A rule stored as an Editor's write leaves it, private details and all, without the route's checks.
function stored(extra: Partial<AutomationRule>): AutomationRule {
  const stamp = { by: { id: 'p-ana', name: 'Ana Costa', color: '#123456' }, at: 1_000 };
  const rule: AutomationRule = {
    ...ruleBody(),
    id: crypto.randomUUID(),
    enabled: true,
    made: stamp,
    edited: stamp,
    ...extra,
  };
  w.plans.get('A')!.room.automations.store.insert(rule);
  return rule;
}

describe('who may read a rule’s summary', () => {
  it('answers the owner, a team member, an Editor link, a Participant, a Viewer, a read-only token and a guest', async () => {
    const rule = await w.rule({ name: 'Done stamp' });
    for (const who of [
      'owner',
      'team',
      'editor_link',
      'participant',
      'viewer',
      'token_read_only',
      'token_participant',
      'guest',
    ] as const) {
      expect(await read(`rule=${rule.id}`, who), who).toMatchObject({
        id: rule.id,
        name: 'Done stamp',
        on: true,
        trigger: 'When Card Moved to Done',
        steps: [{ words: 'Add Label shipped' }],
        made: { by: expect.any(String) },
      });
    }
  });

  it('answers a share-link visitor with no account, on the guest token every visitor holds', async () => {
    const rule = await w.rule({ name: 'Done stamp' });
    expect((await read(`rule=${rule.id}`, 'link_guest')).name).toBe('Done stamp');
    // With no identity at all the worker asks for one first, as it does for a card.
    const bare = await summary(`rule=${rule.id}`, 'link_visitor');
    expect(bare.status).toBe((await w.as('link_visitor', 'GET', '/items')).status);
  });

  it('finds a rule by its name as a history line keeps it, case aside', async () => {
    const rule = await w.rule({ name: 'Done stamp' });
    expect((await read('name=done%20STAMP', 'viewer')).id).toBe(rule.id);
  });

  it('says a rule gone, or never named, is not found', async () => {
    const rule = await w.rule({ name: 'Done stamp' });
    expect((await w.call('DELETE', `/${rule.id}`)).status).toBe(204);
    for (const query of [`rule=${rule.id}`, 'name=Done%20stamp', '', `rule=${'x'.repeat(201)}`]) {
      const res = await summary(query, 'viewer');
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'automation_not_found' });
    }
  });

  it('is a read: any other verb is refused', async () => {
    const res = await w.call('POST', '/summary', {}, 'viewer');
    expect(res.status).toBe(405);
  });

  it('gives a tab-scoped link only a rule that acted on a card its tab shows', async () => {
    const acted = await w.rule({ name: 'Done stamp' });
    const idle = await w.rule({
      name: 'Never ran',
      trigger: { kind: 'card_moved', to: ['doing'] },
    });
    const commented = await w.rule({
      name: 'Says so',
      trigger: { kind: 'card_moved', to: ['done'] },
      steps: [{ kind: 'comment', text: 'Shipped' }],
    });
    // A tab that shows no card yet reads no rule.
    expect((await summary(`rule=${acted.id}&tabId=t1`, 'tab_editor_link')).status).toBe(404);
    const card = await w.make('A', { title: 'On the board' });
    await w.send('POST', `/api/projects/A/items/${card.id}/move`, { status: 'done' });
    await w.plans.get('A')!.room.alarm();
    expect((await read(`rule=${acted.id}&tabId=t1`, 'tab_editor_link')).name).toBe('Done stamp');
    expect((await read(`rule=${commented.id}&tabId=t1`, 'tab_editor_link')).name).toBe('Says so');
    expect((await summary(`rule=${idle.id}&tabId=t1`, 'tab_editor_link')).status).toBe(404);
    // A tab-scoped link must name its tab, as for a card.
    expect((await summary(`rule=${acted.id}`, 'tab_editor_link')).status).toBeGreaterThanOrEqual(
      400,
    );
  });
});

describe('what a rule’s summary holds', () => {
  it('names the plan’s saved filters, columns and tabs as the board does', async () => {
    const board = w.plans.get('A')!.db;
    const data = JSON.parse(
      (board.prepare("SELECT data FROM tabs WHERE id = 't1'").get() as { data: string }).data,
    ) as { elements: { planBoard: Record<string, unknown> }[] };
    data.elements[0]!.planBoard['savedFilters'] = [{ id: 'f1', name: 'Urgent Bugs', text: 'bug' }];
    board
      .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
      .run(JSON.stringify(data));
    const rule = stored({
      name: 'Filtered',
      conditions: [{ kind: 'saved_filter', tab: 't1', filter: 'f1' }],
    });
    expect((await read(`rule=${rule.id}`, 'viewer')).conditions).toEqual(['Matches Urgent Bugs']);
  });

  it('never holds a typed-in address, a webhook, a sender, a repository or an AI step’s ask', async () => {
    const secrets = [
      'hidden.person@example.com',
      'wh_secret_id',
      'Secret Hook Name',
      '@sender.example',
      'Hidden subject',
      'Hidden body',
      'Hidden message',
    ];
    const rule = stored({
      name: 'Private parts',
      trigger: { kind: 'email_received', sender: '@sender.example' },
      steps: [
        {
          kind: 'email',
          to: { addresses: ['hidden.person@example.com'] },
          subject: 'Hidden subject',
          body: 'Hidden body',
        },
        {
          kind: 'notify',
          via: 'slack',
          webhook: 'wh_secret_id',
          name: 'Secret Hook Name',
          text: 'Hidden message',
        },
        { kind: 'ai', task: 'summarise' },
      ],
    });
    const hook = stored({ name: 'Hooked', trigger: { kind: 'incoming_webhook' } as never });
    for (const who of ['viewer', 'participant', 'owner'] as const) {
      const res = await summary(`rule=${rule.id}`, who);
      const text = await res.text();
      for (const secret of secrets) expect(text, who).not.toContain(secret);
      const hookText = await (await summary(`rule=${hook.id}`, who)).text();
      expect(hookText).not.toContain('/api/hooks/');
      expect(hookText).not.toContain('secret');
    }
    const shown = await read(`rule=${rule.id}`, 'viewer');
    expect(shown.steps.map((s) => s.words)).toEqual([
      'Email 1 Address',
      'Post to Slack',
      'An AI Step',
    ]);
  });
});
