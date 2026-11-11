// Archived (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived", blueprints/archive.md): an item its
// owner put away. It moves to their archive scope (`a:<owner>`), which no person's or team's list reads, and loses
// every way anyone else had in (its links, its team) and every row that would list it (favourites, opens, use days,
// the Inbox), in one batch. Its owner still reaches it (directAccess reads owner_id), so its preview draws, but no
// grant is signed for it: it is moved out first, by a PATCH naming a folder or a team (items.ts).

import { loadItem } from './access';
import { callApp } from './app-calls';
import { archivedScope } from './auth';
import type { RouteContext } from './context';
import { touchItem } from './drive';
import type { Env } from './env';
import { conflict, forbidden, json } from './http';
import { decorate, getItemRow, type Access, type ItemRow } from './rows';
import { eventStatements } from './events';

/** Whether a row is in its owner's Archived. */
export const isArchived = (row: Pick<ItemRow, 'archived_at'>) => row.archived_at != null;

/** The refusal every opening verb answers an archived item's owner (grant, open, copy, favourite, share). */
export const archivedRefusal = () => conflict('archived');

// The tables that hold an item's Inbox rows, children first.
const INBOX_TABLES = [
  'collab_thread_people',
  'collab_threads',
  'collab_actions',
  'collab_form_reads',
  'collab_forms',
] as const;

/** The statements that archive `row` at `now`, in the order blueprints/archive.md lists them. */
export function archiveStatements(
  env: Env,
  row: ItemRow,
  actorId: string | null,
  now: number,
): D1PreparedStatement[] {
  const db = env.INDEX_DB;
  const to = archivedScope(row.owner_id);
  const byItem = (table: string) =>
    db.prepare(`DELETE FROM ${table} WHERE item_id = ?`).bind(row.id);
  return [
    db
      .prepare(
        `UPDATE items SET archived_at = ?, scope = ?, team_id = NULL, folder_id = NULL
         WHERE id = ? AND archived_at IS NULL AND trashed_at IS NULL`,
      )
      .bind(now, to, row.id),
    // Its History stays its owner's; its favourites' events go with the favourites (Archived holds none).
    db.prepare(`DELETE FROM events WHERE item_id = ? AND type = 'favourited'`).bind(row.id),
    // "To Archived", in its team's audit log when it left one.
    ...eventStatements(db, {
      itemId: row.id,
      type: 'moved',
      actorId,
      detail: { folderName: 'Archived', teamId: null, fromTeamId: row.team_id, archived: '1' },
      at: now,
      auditTeams: row.team_id ? [row.team_id] : [],
    }),
    // Its links, its password and what they let people keep, for good.
    byItem('shared_with'),
    byItem('share_links'),
    byItem('share_passwords'),
    // Every person's favourite, Recent and Most Used rows, so moving it out starts fresh.
    byItem('favourites'),
    byItem('opens'),
    byItem('use_days'),
    // Its Inbox: threads, the people in them, actions, forms and who read them.
    ...INBOX_TABLES.map(byItem),
  ];
}

// POST /items/:id/archive: its owner's alone.
export async function archiveItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const { row } = loaded;
  const person = caller.person;
  // A team's item is its maker's to archive; another teammate edits it, but it isn't theirs to put away.
  if (!person || person.id !== row.owner_id) return forbidden('not_owner');
  const own: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  const answer = async (next: ItemRow) => {
    const [item] = await decorate(env, person, [next], new Map([[next.id, own]]));
    return json({ item });
  };
  if (isArchived(row)) return answer(row);
  if (row.trashed_at !== null) return conflict('trashed');
  const { results: links } = await env.INDEX_DB.prepare(
    'SELECT code FROM share_links WHERE item_id = ?',
  )
    .bind(id)
    .all<{ code: string }>();
  await env.INDEX_DB.batch(archiveStatements(env, row, person.id, Date.now()));
  // The sessions its links admitted end now; an owner's or teammate's when their grant is next renewed.
  const codes = links.map((l) => l.code);
  if (codes.length > 0) {
    ctx.waitUntil(
      callApp(env, row.app, 'POST', `/items/${encodeURIComponent(id)}/revoke`, { codes }).then(
        (res) => {
          if (!res.ok)
            console.warn('[index] revoke not delivered', { app: row.app, error: res.error });
        },
      ),
    );
  }
  // Its owner's mirror (a team item's leaves no personal mirror behind).
  touchItem(ctx.drive, { owner_id: row.owner_id, team_id: null });
  console.info('[index] archived', {
    app: row.app,
    team: row.team_id !== null,
    links: codes.length,
  });
  return answer((await getItemRow(env, id))!);
}
