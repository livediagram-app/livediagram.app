// The plan's cards in liveworkspace's Inbox (docs/specs/013-workspace/inbox.md; liveworkspace/docs/one-explorer-
// contracts.md "What an item pushes"): every open card assigned to someone and each of its cards' comment threads, pushed
// under COLLAB_CARDS_TAB by the outbox drain (plan-outbox.ts) whenever a card, a board's tab or the type catalogue
// changes. A card tells each person a notifying Person field of its type holds (@liveplanner/items notifiedPeople;
// docs/specs/026-plan/item-types.md "Notifies"), one action each. A person is a one-way hash (@liveplanner/items
// itemPersonId); @liveworkspace/index-app `cardsCollabPush` names them by matching it against the people the plan
// knows: its owner, the editors it has seen (`known_people`) and everyone who commented on or was mentioned in a card.

import {
  cardsCollabPush,
  type CardsPush,
  type InboxCardAssignee,
  type InboxCardSource,
} from '@liveworkspace/index-app';
import {
  ARCHIVED_FIELD,
  FALLBACK_ITEM_TYPE,
  itemPersonId,
  itemStatus,
  itemTitle,
  notifiedPeople,
  typesOf,
  type Item,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import {
  cardPlacesOf,
  threadTitle,
  type CardThread,
  type Comment,
  type Element,
} from '@liveplanner/project';
import type { InboxCardThread } from '@liveworkspace/index-app';
import { listItems } from '../db/items';
import { planThreads } from './card-thread-store';
import type { PlanEnv } from '../types';

// Editors the plan remembers for naming assignees; the oldest go first.
export const KNOWN_PEOPLE_MAX = 500;

/** Notes the people who wrote to the plan (its `edit` outbox keys), so a card assigned to them can be named. */
export async function noteKnownPeople(
  env: PlanEnv,
  personIds: readonly string[],
  now: number,
): Promise<void> {
  if (personIds.length === 0) return;
  await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      `INSERT INTO known_people (person_id, seen_at) SELECT value, ? FROM json_each(?) WHERE true
       ON CONFLICT (person_id) DO UPDATE SET seen_at = excluded.seen_at`,
    ).bind(now, JSON.stringify([...new Set(personIds)])),
    env.PLAN_DB.prepare(
      `DELETE FROM known_people WHERE person_id NOT IN
         (SELECT person_id FROM known_people ORDER BY seen_at DESC LIMIT ?)`,
    ).bind(KNOWN_PEOPLE_MAX),
  ]);
}

// A thread as the Inbox reads it: its title, its state and each comment's author, text, time and mentions.
const inboxThreadOf = (t: CardThread): InboxCardThread => ({
  id: t.id,
  title: threadTitle(t),
  resolved: t.resolved,
  comments: t.comments.map((c: Comment) => ({
    authorId: c.authorId ?? null,
    authorName: c.authorName ?? '',
    authorColor: c.authorColor ?? '',
    text: c.text ?? '',
    createdAt: c.createdAt ?? 0,
    mentionIds: (c.mentions ?? []).flatMap((m) =>
      [m.userId, m.memberId].filter((id): id is string => !!id),
    ),
  })),
});

// The people a card tells as the Inbox push takes them: the Assignee's action under the card's id, as before, and
// another field's under `{card id}~{field id}` (one-explorer-contracts.md "What an item pushes").
const inboxAssigneesOf = (
  item: Pick<Item, 'id'>,
  told: ReturnType<typeof notifiedPeople>,
): InboxCardAssignee[] =>
  told.map(({ fieldId, person }) => ({
    hash: person.id,
    name: person.name,
    actionId: fieldId === 'assignee' ? item.id : `${item.id}~${fieldId}`,
  }));

function parseElements(data: string): Element[] {
  try {
    const body = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(body.elements) ? (body.elements as Element[]) : [];
  } catch {
    return [];
  }
}

function parseTypes(raw: string | null): ItemTypeCatalogue | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ItemTypeCatalogue;
  } catch {
    return null;
  }
}

/** The cards push for the plan, read from its own tables: its cards, the tabs with boards on them, its types. */
export async function cardsPushOf(env: PlanEnv, planId: string): Promise<CardsPush> {
  const [plan, boardTabs, people, items, threads] = await Promise.all([
    env.PLAN_DB.prepare('SELECT owner_id, team_id, item_types FROM plan WHERE id = ?')
      .bind(planId)
      .first<{ owner_id: string; team_id: string | null; item_types: string | null }>(),
    // Only the tabs a board is on: the rest place no card. Their order is the plan's.
    env.PLAN_DB.prepare(
      `SELECT t.id, t.name, t.data FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id
        WHERE dt.plan_id = ? AND t.data LIKE '%"plan-board"%' ORDER BY dt.order_index`,
    )
      .bind(planId)
      .all<{ id: string; name: string; data: string }>(),
    env.PLAN_DB.prepare('SELECT person_id FROM known_people').all<{ person_id: string }>(),
    listItems(env, planId),
    // Its cards' threads, its own and those shared in from other plans (each read from its home).
    planThreads(env, planId),
  ]);
  if (!plan) return { push: { threads: [], actions: [] }, unmatched: 0, people: 0 };
  const ownerId = plan.owner_id;
  const places = cardPlacesOf(
    (boardTabs.results ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      elements: parseElements(t.data),
    })),
  );
  const types = new Map(typesOf(parseTypes(plan.item_types)).map((t) => [t.id, t]));
  // Each card's threads, oldest link first, so a thread on two cards is pushed on the first (cardsCollabPush).
  const threadsByCard = new Map<string, InboxCardThread[]>();
  for (const t of threads) {
    for (const c of t.cards) {
      if (c.projectId !== planId) continue;
      const list = threadsByCard.get(c.itemId) ?? [];
      list.push(inboxThreadOf(t));
      threadsByCard.set(c.itemId, list);
    }
  }
  const cards: InboxCardSource[] = [];
  for (const item of items) {
    // Archived or in the Trash: the Inbox lists neither.
    if (item.fields[ARCHIVED_FIELD] === true) continue;
    const status = itemStatus(item);
    if (status === 'trash') continue;
    const type = types.get(item.type);
    // A custom person (an `n-` named person) is nobody the index could name: never listed, never counted as
    // unmatched (docs/specs/026-plan/items.md "Custom assignees"); notifiedPeople leaves them out.
    const told = notifiedPeople(type ?? FALLBACK_ITEM_TYPE, item);
    const cardThreads = threadsByCard.get(item.id) ?? [];
    // Listed for the people it tells while open; a linked card's action is listed already
    // (docs/specs/026-plan/linked-boards.md "The Inbox").
    const listed = told.length > 0 && item.fields['linked'] == null && !places.isDone(status);
    if (!listed && cardThreads.length === 0) continue;
    cards.push({
      id: item.id,
      card: {
        key: item.key,
        type: item.type,
        typeLabel: type?.label ?? item.type,
        title: itemTitle(item) || 'Untitled',
        board: places.boardFor(status),
      },
      teamId: plan.team_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      assignees: listed ? inboxAssigneesOf(item, told) : [],
      changedBy: item.updatedBy ? { hash: item.updatedBy.id, name: item.updatedBy.name } : null,
      threads: cardThreads,
    });
  }
  return cardsCollabPush(cards, {
    people: [ownerId, ...(people.results ?? []).map((p) => p.person_id)],
    hashOf: itemPersonId,
    fallbackAssignerId: ownerId,
  });
}
