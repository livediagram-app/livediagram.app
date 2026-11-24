// The knowledgebase something from an item goes to by default (item-calls.md "After the call", write-up.md "Where it
// goes"): one connected to the item (either way), else the newest of the item's team, and for a write-up of an item
// with no team, the person's own newest; always one the person can edit, else none.
import { loadItem } from './access';
import type { Person } from './auth';
import type { Env } from './env';
import type { ItemRow } from './rows';

type Kb = { id: string; title: string };

const LIVE = `app = 'liveknowledge' AND trashed_at IS NULL AND archived_at IS NULL`;

export async function defaultKnowledgebase(
  env: Env,
  item: ItemRow,
  person: Person,
  options: { own?: boolean } = {},
): Promise<Kb | null> {
  const connected = await env.INDEX_DB.prepare(
    `SELECT i.id, i.title FROM connections c JOIN items i
       ON (c.host_item_id = ?1 AND i.id = c.target_item_id) OR (c.target_item_id = ?1 AND i.id = c.host_item_id)
     WHERE i.app = 'liveknowledge' AND i.trashed_at IS NULL AND i.archived_at IS NULL
     ORDER BY c.created_at DESC LIMIT 1`,
  )
    .bind(item.id)
    .first<Kb>();
  const candidate =
    connected ??
    (item.team_id
      ? await env.INDEX_DB.prepare(
          `SELECT id, title FROM items WHERE team_id = ? AND ${LIVE} ORDER BY updated_at DESC LIMIT 1`,
        )
          .bind(item.team_id)
          .first<Kb>()
      : options.own
        ? await env.INDEX_DB.prepare(
            `SELECT id, title FROM items WHERE owner_id = ? AND team_id IS NULL AND ${LIVE}
               ORDER BY updated_at DESC LIMIT 1`,
          )
            .bind(person.id)
            .first<Kb>()
        : null);
  if (!candidate) return null;
  const can = await loadItem(env, candidate.id, { person, share: null }, 'edit');
  if (can instanceof Response) {
    await can.body?.cancel();
    return null;
  }
  return { id: candidate.id, title: candidate.title };
}
