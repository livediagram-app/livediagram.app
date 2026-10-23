// Item rows and their wire shape. Decorating a page for the person asking (favourite, tags, last opened,
// link access) is one D1 batch of four statements whatever the page's size, never a query per item.

import {
  type App,
  type Item,
  type ItemSource,
  type ItemSummary,
  type Kind,
  type Level,
  type TrashReason,
} from '@liveworkspace/index-client';
import type { Person } from './auth';
import type { Env } from './env';

export type ItemRow = {
  id: string;
  app: App;
  kind: Kind;
  owner_id: string;
  team_id: string | null;
  scope: string;
  folder_id: string | null;
  title: string;
  source: ItemSource | null;
  intent: string | null;
  summary: string;
  created_at: number;
  updated_at: number;
  trashed_at: number | null;
  trash_reason: TrashReason | null;
};

export const ITEM_COLUMNS =
  'i.id, i.app, i.kind, i.owner_id, i.team_id, i.scope, i.folder_id, i.title, i.source, i.intent, ' +
  'i.summary, i.created_at, i.updated_at, i.trashed_at, i.trash_reason';

// How a caller reaches an item: as its owner, as a joined member of its team, or through a link.
export type Access = {
  level: Level;
  tabId: string | null;
  via: 'owner' | 'team' | 'link';
  code: string | null;
};

export const MANAGER_VIAS = new Set<Access['via']>(['owner', 'team']);

export async function getItemRow(env: Env, id: string): Promise<ItemRow | null> {
  return env.INDEX_DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items i WHERE i.id = ?`)
    .bind(id)
    .first<ItemRow>();
}

// Owner or joined team member: edit everything, no link needed.
export function directAccess(row: ItemRow, person: Person | null): Access | null {
  if (!person) return null;
  if (row.owner_id === person.id) return { level: 'edit', tabId: null, via: 'owner', code: null };
  if (row.team_id && person.teams.includes(row.team_id)) {
    return { level: 'edit', tabId: null, via: 'team', code: null };
  }
  return null;
}

function parseSummary(text: string): ItemSummary {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as ItemSummary)
      : {};
  } catch {
    return {};
  }
}

type Extras = {
  favourite: boolean;
  tagIds: string[];
  lastOpenedAt: number | null;
  hiddenFromRecent: boolean;
  // Whether it has a live share link (the owner's or a team member's Shared badge).
  hasLinks?: boolean;
};

export function toItem(row: ItemRow, access: Access, extras: Extras): Item {
  return {
    id: row.id,
    app: row.app,
    kind: row.kind,
    title: row.title,
    ownerId: row.owner_id,
    teamId: row.team_id,
    folderId: row.folder_id,
    source: row.source,
    intent: row.intent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trashedAt: row.trashed_at,
    trashReason: row.trash_reason,
    summary: parseSummary(row.summary),
    access: access.level,
    favourite: extras.favourite,
    tagIds: extras.tagIds,
    lastOpenedAt: extras.lastOpenedAt,
    hiddenFromRecent: extras.hiddenFromRecent,
    hasLinks: extras.hasLinks === true,
    sharedVia: access.via === 'link' ? access.code : null,
  };
}

// The live-link predicate on a share_links alias.
export const LIVE_LINK = (alias: string) =>
  `(${alias}.expires_at IS NULL OR ${alias}.expires_at > ?)`;

// Items as the person sees them. `known` carries access already worked out (a single item's, or a
// link's); everything else is found here, in one batch. A row the person cannot reach is dropped.
export async function decorate(
  env: Env,
  person: Person | null,
  rows: ItemRow[],
  known: Map<string, Access> = new Map(),
): Promise<Item[]> {
  if (rows.length === 0) return [];
  const access = new Map(known);
  for (const row of rows) {
    if (access.has(row.id)) continue;
    const direct = directAccess(row, person);
    if (direct) access.set(row.id, direct);
  }
  const none: Extras = {
    favourite: false,
    tagIds: [],
    lastOpenedAt: null,
    hiddenFromRecent: false,
  };
  if (!person) {
    return rows.flatMap((row) => {
      const a = access.get(row.id);
      return a ? [toItem(row, a, none)] : [];
    });
  }

  const ids = JSON.stringify(rows.map((r) => r.id));
  const viaLink = JSON.stringify(rows.filter((r) => !access.has(r.id)).map((r) => r.id));
  // Items the person manages (owner or team): whether each has a live link, for its Shared badge.
  const managed = JSON.stringify(
    rows.filter((r) => access.get(r.id)?.via !== 'link' && access.has(r.id)).map((r) => r.id),
  );
  const db = env.INDEX_DB;
  const now = Date.now();
  const [favourites, tags, opens, links, shared] = (await db.batch([
    db
      .prepare(
        'SELECT item_id FROM favourites WHERE person_id = ? AND item_id IN (SELECT value FROM json_each(?))',
      )
      .bind(person.id, ids),
    db
      .prepare(
        `SELECT it.item_id, it.tag_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id IN (SELECT value FROM json_each(?)) AND t.owner_id = ? ORDER BY t.name`,
      )
      .bind(ids, person.id),
    db
      .prepare(
        'SELECT item_id, last_opened_at, hidden FROM opens WHERE person_id = ? AND item_id IN (SELECT value FROM json_each(?))',
      )
      .bind(person.id, ids),
    db
      .prepare(
        `SELECT sw.item_id, sl.code, sl.level, sl.tab_id FROM shared_with sw
         JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
         WHERE sw.person_id = ? AND sw.item_id IN (SELECT value FROM json_each(?)) AND ${LIVE_LINK('sl')}`,
      )
      .bind(person.id, viaLink, now),
    db
      .prepare(
        `SELECT DISTINCT sl.item_id FROM share_links sl
         WHERE sl.item_id IN (SELECT value FROM json_each(?)) AND ${LIVE_LINK('sl')}`,
      )
      .bind(managed, now),
  ])) as D1Result<Record<string, unknown>>[];
  const withLinks = new Set(shared!.results.map((r) => r.item_id as string));

  const favourite = new Set(favourites!.results.map((r) => r.item_id as string));
  const tagIds = new Map<string, string[]>();
  for (const r of tags!.results) {
    const list = tagIds.get(r.item_id as string) ?? [];
    list.push(r.tag_id as string);
    tagIds.set(r.item_id as string, list);
  }
  // An item hidden before it was ever opened has last_opened_at 0: never opened.
  const opened = new Map<string, number>();
  const hidden = new Set<string>();
  for (const r of opens!.results) {
    if ((r.last_opened_at as number) > 0)
      opened.set(r.item_id as string, r.last_opened_at as number);
    if (r.hidden === 1) hidden.add(r.item_id as string);
  }
  for (const r of links!.results) {
    access.set(r.item_id as string, {
      level: r.level as Level,
      tabId: (r.tab_id as string | null) ?? null,
      via: 'link',
      code: r.code as string,
    });
  }
  return rows.flatMap((row) => {
    const a = access.get(row.id);
    if (!a) return [];
    return [
      toItem(row, a, {
        favourite: favourite.has(row.id),
        tagIds: tagIds.get(row.id) ?? [],
        lastOpenedAt: opened.get(row.id) ?? null,
        hiddenFromRecent: hidden.has(row.id),
        hasLinks: withLinks.has(row.id),
      }),
    ];
  });
}
