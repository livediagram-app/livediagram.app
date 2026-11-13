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
  | 'guest'
  // Phase 3's callers (spec "Who may do what"): a read-only token, a token whose account is a Participant or holds a
  // link to one tab, a workbench session, and a link visitor with no account.
  | 'token_read_only'
  | 'token_participant'
  | 'token_tab'
  | 'workbench'
  | 'link_visitor';

const LEVELS: Record<Caller, string> = {
  owner: 'edit',
  team: 'edit',
  editor_link: 'edit',
  tab_editor_link: 'edit',
  participant: 'participate',
  viewer: 'view',
  token: 'edit',
  guest: 'edit',
  token_read_only: 'edit',
  token_participant: 'participate',
  token_tab: 'edit',
  workbench: 'edit',
  link_visitor: 'edit',
};

const isToken = (who: Caller) => who === 'token' || who.startsWith('token_');

export const USER = 'user_2abcdefghijklmnopqrstuvwxyz1';

// A workbench session on the plan, at edit: a person's editor on one plan, never let near rules.
const WORKBENCH = {
  sessionId: 'wbs_1',
  ownerId: USER,
  tokenId: 'tok_1',
  pairingId: 'wbp_1',
  tabId: null,
  origin: 'https://workbench.test',
  level: 'edit',
  expiresAt: 9e15,
} as never;

function identityOf(planId: string, who: Caller): RouteIdentity {
  const account = who === 'guest' || who === 'link_visitor' ? null : USER;
  const owner = who === 'link_visitor' ? null : (account ?? 'guest_owner');
  return {
    accountUserId: isToken(who) || who === 'workbench' ? null : account,
    verifiedUserId: who === 'workbench' ? null : account,
    accountEmail: null,
    owner,
    token: isToken(who)
      ? { id: 'tok_1', ...(who === 'token_read_only' ? { readOnly: true } : {}) }
      : null,
    workbench: who === 'workbench' ? WORKBENCH : null,
    teams: who === 'team' ? [{ id: 'team_1', name: 'Team', role: 'member' } as never] : null,
    bearer: null,
    grant: {
      item: planId,
      level: LEVELS[who],
      tab: who === 'tab_editor_link' || who === 'token_tab' ? 't1' : null,
      sub: account ?? 'guest_owner',
      team: who === 'team' ? 'team_1' : null,
      exp: 9e9,
      shareCode:
        who.endsWith('link') || who === 'participant' || who === 'viewer' || who === 'link_visitor'
          ? 'code1'
          : null,
    } as never,
  };
}

export type AutomationWorld = RepeatWorld & {
  call: (method: string, path: string, body?: unknown, who?: Caller) => Promise<Response>;
  // An Automations route given the body's text as sent, malformed or not.
  callText: (method: string, path: string, text: string, who?: Caller) => Promise<Response>;
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
  const callText = (
    method: string,
    path: string,
    text: string | undefined,
    who: Caller = 'owner',
  ) =>
    w.plans.get(planId)!.room.route(
      planId,
      new Request(`https://api.test/api/projects/${planId}/automations${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(text === undefined ? {} : { body: text }),
      }),
      identityOf(planId, who),
    );
  const call = (method: string, path: string, body?: unknown, who: Caller = 'owner') =>
    callText(method, path, body === undefined ? undefined : JSON.stringify(body), who);
  const rule = async (body: Partial<AutomationRuleBody>) => {
    const res = await call('POST', '', ruleBody(body));
    if (res.status !== 201)
      throw new Error(`rule create answered ${res.status}: ${await res.text()}`);
    return (await res.json<{ rule: AutomationRule }>()).rule;
  };
  return { ...w, call, callText, as, rule };
}
