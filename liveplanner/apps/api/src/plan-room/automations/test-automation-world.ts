// A world for Automations' tests (docs/specs/026-plan/automations.md): the repeat world's real worker and PlanRooms
// (test-repeat-world.ts) with a kanban board on the plan's tab, and `call`, which answers an Automations route
// through the room as a caller of a given kind (owner, team member, Editor link, tab-scoped Editor link, Participant,
// Viewer, API token). Not a `.test.ts` file, so vitest does not collect it.
import { presetSetup, type AutomationRuleBody, type AutomationRule } from '@liveplanner/items';
import type { RouteIdentity } from '../plan-route';
import { createPlan, repeatWorld, type RepeatWorld } from '../test-repeat-world';

export type Caller =
  | 'owner'
  | 'team'
  | 'editor_link'
  | 'tab_editor_link'
  | 'participant'
  | 'viewer'
  | 'token'
  | 'guest';

const LEVELS: Record<Caller, string> = {
  owner: 'edit',
  team: 'edit',
  editor_link: 'edit',
  tab_editor_link: 'edit',
  participant: 'participate',
  viewer: 'view',
  token: 'edit',
  guest: 'edit',
};

export const USER = 'user_2abcdefghijklmnopqrstuvwxyz1';

function identityOf(planId: string, who: Caller): RouteIdentity {
  const account = who === 'guest' ? null : USER;
  return {
    accountUserId: who === 'token' ? null : account,
    verifiedUserId: account,
    accountEmail: null,
    owner: account ?? 'guest_owner',
    token: who === 'token' ? { id: 'tok_1' } : null,
    workbench: null,
    teams: who === 'team' ? [{ id: 'team_1', name: 'Team', role: 'member' } as never] : null,
    bearer: null,
    grant: {
      item: planId,
      level: LEVELS[who],
      tab: who === 'tab_editor_link' ? 't1' : null,
      sub: account ?? 'guest_owner',
      team: who === 'team' ? 'team_1' : null,
      exp: 9e9,
      shareCode: who.endsWith('link') || who === 'participant' || who === 'viewer' ? 'code1' : null,
    } as never,
  };
}

export type AutomationWorld = RepeatWorld & {
  call: (method: string, path: string, body?: unknown, who?: Caller) => Promise<Response>;
  // Any of the plan's routes (`/items/…`) through its room as a caller of a given kind (an API token's write is an
  // agent's, tagged 'ai').
  as: (who: Caller, method: string, path: string, body?: unknown) => Promise<Response>;
  // A rule made through the route, answered as stored.
  rule: (body: Partial<AutomationRuleBody>) => Promise<AutomationRule>;
};

export const ruleBody = (r: Partial<AutomationRuleBody> = {}): AutomationRuleBody => ({
  name: 'Done stamp',
  trigger: { kind: 'card_moved', to: ['done'] },
  conditions: [],
  steps: [{ kind: 'add_label', label: 'shipped' }],
  chain: false,
  timeZone: 'Europe/London',
  ...r,
});

export async function automationWorld(planId = 'A'): Promise<AutomationWorld> {
  const w = repeatWorld();
  await createPlan(w, planId);
  const tab = {
    id: 't1',
    name: 'Board',
    kind: 'board',
    elements: [
      {
        id: 'b1',
        type: 'shape',
        shape: 'plan-board',
        x: 0,
        y: 0,
        width: 800,
        height: 500,
        planBoard: presetSetup('kanban'),
      },
    ],
  };
  const put = await w.send('PUT', `/api/projects/${planId}/tabs/t1`, tab);
  if (put.status >= 300) throw new Error(`tab put answered ${put.status}: ${await put.text()}`);
  const as = (who: Caller, method: string, path: string, body?: unknown) =>
    w.plans.get(planId)!.room.route(
      planId,
      new Request(`https://api.test/api/projects/${planId}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      identityOf(planId, who),
    );
  const call = (method: string, path: string, body?: unknown, who: Caller = 'owner') =>
    w.plans.get(planId)!.room.route(
      planId,
      new Request(`https://api.test/api/projects/${planId}/automations${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      identityOf(planId, who),
    );
  const rule = async (body: Partial<AutomationRuleBody>) => {
    const res = await call('POST', '', ruleBody(body));
    if (res.status !== 201)
      throw new Error(`rule create answered ${res.status}: ${await res.text()}`);
    return (await res.json<{ rule: AutomationRule }>()).rule;
  };
  return { ...w, call, as, rule };
}
