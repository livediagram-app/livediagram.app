import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule } from '@liveplanner/items';
import { endRepeatWorld, repeatWorld, type RepeatWorld } from '../plan-room/test-repeat-world';
import { identityOf, type Caller } from '../plan-room/automations/test-automation-world';
import type { PlanRoom } from '../plan-room/plan-room';
import { starterRulesAsked } from './starter-rules';
import { templateStarterRules } from '@liveplanner/templates/template-starter-rules';

// A template's starter rules on the API's create (docs/specs/026-plan/plan-templates.md "Starter rules"): a signed-in
// person's or their token's create with a seeded template tab starts the plan with its rules, on or off as shipped; a
// guest's, a workbench session's and a plan of no listed template start with none.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: RepeatWorld;
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = repeatWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const roomOf = (id: string) =>
  (Reflect.get(w.env, 'PLAN_ROOM') as { get: (id: { name: string }) => PlanRoom }).get({
    name: id,
  });

const create = (id: string, template: string, who: Caller, extra: Record<string, unknown> = {}) =>
  roomOf(id).route(
    id,
    new Request('https://api.test/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: 'Plan',
        tabs: [{ id: 't1', name: 'Tab 1', template }],
        ...extra,
      }),
    }),
    identityOf(id, who),
  );

const rulesOf = (id: string): AutomationRule[] =>
  (
    Reflect.get(roomOf(id), 'automations') as { store: { list: () => AutomationRule[] } }
  ).store.list();

describe('starter rules on create', () => {
  it.each<Caller>(['owner', 'token'])('a %s’s Sprint Board starts with its rules', async (who) => {
    expect((await create('P', 'sprint-board', who)).status).toBe(201);
    const rules = rulesOf('P');
    expect(rules.map((r) => [r.name, r.enabled])).toEqual(
      templateStarterRules('sprint-board', 'UTC').map((r) => [r.body.name, r.on]),
    );
    expect(rules.some((r) => r.enabled) && rules.some((r) => !r.enabled)).toBe(true);
    expect(rules[0]!.made).toMatchObject({ by: { name: expect.any(String) } });
    expect(!!rules[0]!.made.ai).toBe(who === 'token');
    // None sends an email or calls a webhook.
    const kinds = rules.flatMap((r) => r.steps.map((s) => s.kind));
    expect(kinds).not.toContain('email');
    expect(kinds).not.toContain('notify');
  });

  it.each<Caller>(['guest', 'workbench'])('a %s’s plan starts with none', async (who) => {
    expect((await create('P', 'sprint-board', who)).status).toBe(201);
    expect(rulesOf('P')).toEqual([]);
  });

  it('makes none for a template that lists none, or a re-commit of a plan already made', async () => {
    expect((await create('P', 'budget-planner', 'owner')).status).toBe(201);
    expect(rulesOf('P')).toEqual([]);
    const kanban = templateStarterRules('kanban', 'UTC').map((r) => r.body.name);
    expect((await create('Q', 'kanban', 'owner')).status).toBe(201);
    expect(rulesOf('Q').map((r) => r.name)).toEqual(kanban);
    expect((await create('Q', 'kanban', 'owner')).status).toBe(201);
    expect(rulesOf('Q')).toHaveLength(kanban.length);
  });
});

const createBuilt = (id: string, starterRules: unknown, who: Caller) =>
  roomOf(id).route(
    id,
    new Request('https://api.test/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: 'Plan',
        tabs: [{ id: 't1', name: 'Tab 1', elements: [] }],
        starterRules,
      }),
    }),
    identityOf(id, who),
  );

describe('a create that names its template (the wizard, an Offline Mode sync)', () => {
  it('makes the rules in the time zone given', async () => {
    const res = await createBuilt('P', { template: 'kanban', timeZone: 'Europe/London' }, 'owner');
    expect(res.status).toBe(201);
    const rules = rulesOf('P');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.timeZone === 'Europe/London')).toBe(true);
  });

  it('makes none for a guest, and never refuses the create over a malformed ask', async () => {
    expect((await createBuilt('P', { template: 'kanban' }, 'guest')).status).toBe(201);
    expect(rulesOf('P')).toEqual([]);
    expect((await createBuilt('Q', 'kanban', 'owner')).status).toBe(201);
    expect(rulesOf('Q')).toEqual([]);
  });
});

describe('starterRulesAsked', () => {
  it('reads a template with starter rules and a time zone this runtime knows', () => {
    expect(starterRulesAsked({ template: 'kanban', timeZone: 'Asia/Tokyo' })).toEqual({
      template: 'kanban',
      timeZone: 'Asia/Tokyo',
    });
    expect(starterRulesAsked({ template: 'kanban', timeZone: 'Mars/Olympus' })).toEqual({
      template: 'kanban',
    });
    expect(starterRulesAsked({ template: 'kanban', timeZone: 'x'.repeat(65) })).toEqual({
      template: 'kanban',
    });
    expect(starterRulesAsked({ template: 'kanban' })).toEqual({ template: 'kanban' });
    expect(starterRulesAsked({ template: 'budget-planner' })).toBeNull();
    expect(starterRulesAsked(null)).toBeNull();
  });
});
