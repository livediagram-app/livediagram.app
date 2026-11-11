// The plan as its rules read it (docs/specs/026-plan/automations.md "Conditions", "Actions"; blueprint automations.md
// "The run"): its card types, the columns its boards name, its boards' saved filters, its Form tabs and its people
// (whom a card holds, the owner and the team's joined members, each by the hashed id cards carry), read once per wake
// or per request. The people from accounts are best-effort: without the accounts Worker they are the cards' alone.
import {
  isItemPerson,
  isIdentityPersonId,
  itemPersonId,
  normaliseBoardSetup,
  planOutline,
  doneStatusesOf,
  finishedStatuses,
  typesOf,
  AUTOMATION_PERSON_ID,
  type AutomationOutline,
  type AutomationSavedFilter,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { listItems } from '../../db/items';
import { tabOutlines } from '../../db/tab-outlines';
import { planTabs } from '../../routes/plan-route';
import { getParticipants } from '../../person/profiles';
import { teamPeople } from '../../person/notify';
import { appBaseUrl } from '../../email/client';
import type { PlanEnv } from '../../types';
import { readPlanOutline } from '../plan-content';

export interface AutomationPlan {
  outline: AutomationOutline;
  types: readonly ItemTypeDef[];
  // Whether a status is one of the plan's done columns (Overdue leaves those cards out).
  isDone: (status: string | undefined) => boolean;
  name: string;
  ownerId: string;
  teamId: string | null;
  // The plan's own ids behind its people's hashes: the owner, its team's members and the editors it has seen.
  accounts: Map<string, string>;
}

// The link that opens a card, whichever board shows it.
export const cardUrl = (env: PlanEnv, planId: string, cardId: string): string =>
  `${appBaseUrl(env)}/project/${encodeURIComponent(planId)}#item=${encodeURIComponent(cardId)}`;

// The people the plan's cards hold: assignees and Person fields (custom assignees too), and the people who made and
// changed them (never a rule, a form or a Repeat: only an account's or a guest's hashed id).
function cardPeople(items: readonly Item[]): ItemPerson[] {
  const out = new Map<string, ItemPerson>();
  const add = (v: unknown) => {
    if (isItemPerson(v) && v.id && v.id !== AUTOMATION_PERSON_ID && !out.has(v.id))
      out.set(v.id, v);
  };
  for (const item of items) {
    for (const by of [item.createdBy, item.updatedBy]) if (isIdentityPersonId(by.id)) add(by);
    for (const v of Object.values(item.fields)) {
      if (Array.isArray(v)) v.forEach(add);
      else add(v);
    }
  }
  return [...out.values()];
}

// The board set-ups' saved filters, each with its tab and the board's done statuses.
function savedFiltersOf(
  tabs: readonly { id: string; elements: readonly unknown[] }[],
): AutomationSavedFilter[] {
  const out: AutomationSavedFilter[] = [];
  for (const tab of tabs) {
    for (const raw of tab.elements) {
      const el = raw as { shape?: unknown; planBoard?: unknown } | null;
      if (el?.shape !== 'plan-board') continue;
      const setup = normaliseBoardSetup(el.planBoard);
      for (const filter of setup?.savedFilters ?? [])
        out.push({ tab: tab.id, filter, finished: finishedStatuses(setup!) });
    }
  }
  return out;
}

// The owner and the team's joined members, as cards name them, with the account id behind each.
async function accountPeople(
  env: PlanEnv,
  ownerId: string,
  teamId: string | null,
  known: readonly string[],
): Promise<{ people: ItemPerson[]; accounts: Map<string, string> }> {
  const accounts = new Map<string, string>();
  const ids = new Set<string>([ownerId, ...known]);
  const named: string[] = [ownerId];
  try {
    for (const m of teamId ? ((await teamPeople(env, teamId)) ?? []) : []) {
      if (m.status !== 'joined' || !m.userId) continue;
      ids.add(m.userId);
      named.push(m.userId);
    }
  } catch (error) {
    console.warn('[automations] team.unread', { error: String(error) });
  }
  for (const id of ids) accounts.set(await itemPersonId(id), id);
  const profiles = await getParticipants(env, named);
  const people: ItemPerson[] = [];
  for (const id of named) {
    const p = profiles.get(id);
    if (p) people.push({ id: await itemPersonId(id), name: p.name, color: p.color });
  }
  return { people, accounts };
}

export async function readAutomationPlan(env: PlanEnv, planId: string): Promise<AutomationPlan> {
  const [head, tabs, outlines, items, known] = await Promise.all([
    readPlanOutline(env, planId),
    planTabs({ env }, planId, null),
    tabOutlines(env, planId, null),
    listItems(env, planId),
    env.PLAN_DB.prepare('SELECT person_id FROM known_people').all<{ person_id: string }>(),
  ]);
  const types = typesOf(head.itemTypes);
  const ownerId = head.meta?.ownerId ?? '';
  const teamId = head.meta?.teamId ?? null;
  const fromAccounts = await accountPeople(
    env,
    ownerId,
    teamId,
    (known.results ?? []).map((r) => r.person_id),
  );
  const board = planOutline(tabs, head.itemTypes);
  const people = new Map<string, ItemPerson>();
  for (const p of [...fromAccounts.people, ...cardPeople(items)])
    if (!people.has(p.id)) people.set(p.id, p);
  return {
    outline: {
      types,
      statuses: board.statuses,
      people: [...people.values()],
      savedFilters: savedFiltersOf(tabs),
      formTabs: outlines.filter((t) => t.kind === 'form').map((t) => t.id),
    },
    types,
    isDone: doneStatusesOf(board.boards),
    name: head.meta?.name ?? '',
    ownerId,
    teamId,
    accounts: fromAccounts.accounts,
  };
}
