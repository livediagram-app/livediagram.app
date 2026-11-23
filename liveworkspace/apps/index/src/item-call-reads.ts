// Start a Call Here's rows as the wire shows them (liveworkspace/docs/specs/004-index/item-calls.md, blueprint
// item-calls.md "The index"): a call, the live one, an item's meetings with only the pages and plans the reader can
// open, and the signal that tells the item's open editors to read them again.

import { APP_ITEMS } from '@liveworkspace/sites';
import {
  ITEM_CALL_APP,
  ITEM_CALL_CHECKS_MAX,
  ITEM_CALL_INVITE_DAYS,
  ITEM_CALL_START_GRACE_MS,
  ITEM_CALLS_READ_MAX,
  type InboxCallInvite,
  type ItemCall,
  type ItemCallsRead,
  type ItemMeeting,
  type SourceChange,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callApp } from './app-calls';
import type { Person } from './auth';
import { appSiteOrigin } from './connection-rows';
import type { Env } from './env';
import type { ItemRow } from './rows';

export type CallRow = {
  id: string;
  item_id: string;
  space_id: string;
  host_id: string;
  share_code: string | null;
  people: number;
  names: string;
  started_at: number;
  ended_at: number | null;
  summary_item_id: string | null;
  summary_link: string | null;
  summary_title: string | null;
  plan_id: string | null;
};

export const CALL_COLUMNS =
  'id, item_id, space_id, host_id, share_code, people, names, started_at, ended_at, summary_item_id, ' +
  'summary_link, summary_title, plan_id';

const enc = encodeURIComponent;
// The most invites one Inbox read carries.
const ITEM_CALL_INVITES_READ_MAX = 50;

/** The item's own address in its app. */
export const itemLink = (env: Pick<Env, 'ENVIRONMENT'>, item: Pick<ItemRow, 'app' | 'id'>) =>
  `${appSiteOrigin(env, item.app)}${APP_ITEMS[item.app].itemPath}${enc(item.id)}`;

/** The way into a call: its Space's Participant link, or the Space itself once the link is gone. */
export const spaceLink = (
  env: Pick<Env, 'ENVIRONMENT'>,
  row: Pick<CallRow, 'share_code' | 'space_id'>,
) =>
  row.share_code
    ? `${appSiteOrigin(env, ITEM_CALL_APP)}${APP_ITEMS[ITEM_CALL_APP].sharePath}${enc(row.share_code)}`
    : itemLink(env, { app: ITEM_CALL_APP, id: row.space_id });

/** Live: not ended, and someone in it or nobody yet within the start's grace. */
export const isLive = (row: Pick<CallRow, 'ended_at' | 'people' | 'started_at'>, now: number) =>
  row.ended_at === null && (row.people > 0 || row.started_at >= now - ITEM_CALL_START_GRACE_MS);

function namesOf(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

export const callOf = (env: Env, row: CallRow, now: number): ItemCall => ({
  id: row.id,
  spaceId: row.space_id,
  link: spaceLink(env, row),
  people: row.people,
  names: namesOf(row.names),
  startedAt: row.started_at,
  endedAt: row.ended_at,
  live: isLive(row, now),
});

/** The item's live call, if any: the newest not ended. */
export async function liveCallOf(env: Env, itemId: string, now: number): Promise<CallRow | null> {
  const row = await env.INDEX_DB.prepare(
    `SELECT ${CALL_COLUMNS} FROM item_calls WHERE item_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
  )
    .bind(itemId)
    .first<CallRow>();
  return row && isLive(row, now) ? row : null;
}

// The items among `ids` the reader can open themselves (no share code of the item's carries over), with their titles.
async function openable(
  env: Env,
  person: Person | null,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const open = new Map<string, string>();
  if (!person) return open;
  await Promise.all(
    ids.slice(0, ITEM_CALL_CHECKS_MAX).map(async (id) => {
      const loaded = await loadItem(env, id, { person, share: null }, 'view');
      if (loaded instanceof Response) {
        await loaded.body?.cancel();
        return;
      }
      if (loaded.row.trashed_at === null && loaded.row.archived_at === null)
        open.set(id, loaded.row.title);
    }),
  );
  return open;
}

/** An item's live call and meetings, newest first, as `person` may see them. */
export async function readMeetings(
  env: Env,
  itemId: string,
  person: Person | null,
  now: number,
): Promise<ItemCallsRead> {
  const rows =
    (
      await env.INDEX_DB.prepare(
        `SELECT ${CALL_COLUMNS} FROM item_calls WHERE item_id = ? ORDER BY started_at DESC LIMIT ?`,
      )
        .bind(itemId, ITEM_CALLS_READ_MAX)
        .all<CallRow>()
    ).results ?? [];
  const checks = [
    ...new Set(
      rows.flatMap((r) => [r.summary_item_id, r.plan_id]).filter((id): id is string => !!id),
    ),
  ];
  const open = checks.length > 0 ? await openable(env, person, checks) : new Map<string, string>();
  const meetings = rows.map((r): ItemMeeting => ({
    ...callOf(env, r, now),
    summary:
      r.summary_item_id && r.summary_link && open.has(r.summary_item_id)
        ? { title: r.summary_title ?? 'Summary', link: r.summary_link }
        : null,
    plan:
      r.plan_id && open.has(r.plan_id)
        ? {
            id: r.plan_id,
            title: open.get(r.plan_id)!,
            link: itemLink(env, { app: 'liveplanner', id: r.plan_id }),
          }
        : null,
    you: !!person && person.id === r.host_id,
  }));
  const live = meetings.find((m) => m.live) ?? null;
  return {
    live: live
      ? {
          id: live.id,
          spaceId: live.spaceId,
          link: live.link,
          people: live.people,
          names: live.names,
          startedAt: live.startedAt,
          endedAt: live.endedAt,
          live: true,
        }
      : null,
    meetings,
  };
}

/** Tells the item's open editors its calls changed: ids only, through its app's `source-changed` door. */
export async function tellItemCalls(
  env: Env,
  item: Pick<ItemRow, 'id' | 'app'>,
  spaceId: string,
): Promise<void> {
  const change: SourceChange = { app: ITEM_CALL_APP, itemId: spaceId, sheetIds: [], calls: true };
  const res = await callApp(env, item.app, 'POST', `/items/${enc(item.id)}/source-changed`, change);
  if (!res.ok) console.warn('[index] call change not told', { app: item.app, error: res.error });
}

/** The reader's call invites from the last ITEM_CALL_INVITE_DAYS, newest first, on items not in the Trash. */
export function invitesQuery(personId: string, now: number): { sql: string; args: unknown[] } {
  return {
    sql: `SELECT v.id, i.app, i.id AS item_id, i.title AS item_title, v.by_name, v.at,
        c.people, c.started_at, c.ended_at
      FROM item_call_invites v JOIN item_calls c ON c.id = v.call_id JOIN items i ON i.id = c.item_id
      WHERE v.person_id = ? AND v.at >= ? AND i.trashed_at IS NULL
      ORDER BY v.at DESC LIMIT ${ITEM_CALL_INVITES_READ_MAX}`,
    args: [personId, now - ITEM_CALL_INVITE_DAYS * 86_400_000],
  };
}

export const inviteOf =
  (now: number) =>
  (r: Record<string, unknown>): InboxCallInvite => ({
    id: String(r['id']),
    app: r['app'] as InboxCallInvite['app'],
    itemId: String(r['item_id']),
    itemTitle: String(r['item_title'] ?? ''),
    byName: String(r['by_name']),
    at: Number(r['at']),
    live: isLive(
      {
        ended_at: r['ended_at'] === null ? null : Number(r['ended_at']),
        people: Number(r['people']),
        started_at: Number(r['started_at']),
      },
      now,
    ),
  });
