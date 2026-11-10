// A closed account's name off a plan that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which plans name them (POST /api/internal/people/:id/purge), and each plan's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments,
// cards, assignments and reactions in each tab, the cards' own fields, comment threads and history and who made or changed them, the changesets they
// wrote, the sheets they last edited, and the plan's owner when it was their team plan. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.

import {
  ANONYMISED_NAME,
  ANONYMISED_PERSON,
  anonymiseJsonText,
  type Anonymised,
} from '@liveworkspace/index-app';
import { itemPersonId } from '@liveplanner/items';
import { ANONYMISED_ITEM_PERSON } from '../db/items';
import type { PlanEnv } from '../types';

// A closed account as a card, its history and a sheet name them.
const ANONYMISED_AUTHOR = JSON.stringify(ANONYMISED_ITEM_PERSON);

// The SQL that reads a JSON person column's hashed id, or nothing when the column is not JSON (a pre-person row
// holds the raw id), so one odd row can't fail the whole batch.
const personIdOf = (col: string) => `CASE WHEN json_valid(${col}) THEN ${col} ->> '$.id' END`;

// A thread's comments with every reaction the person left (its `person` their hashed id; docs/specs/012-collaboration/
// comment-reactions.md) named Deleted account. Cheap when the text never mentions them; a reaction from before
// reactions kept a person can't be found, and is left.
export function anonymiseReactions(text: string, hashed: string): Anonymised<string> {
  if (!text.includes(hashed)) return { value: text, changed: false };
  let comments: unknown;
  try {
    comments = JSON.parse(text);
  } catch {
    return { value: text, changed: false };
  }
  if (!Array.isArray(comments)) return { value: text, changed: false };
  let changed = false;
  const out = comments.map((c: unknown) => {
    const reactions = (c as { reactions?: unknown } | null)?.reactions;
    if (!Array.isArray(reactions)) return c;
    return {
      ...(c as object),
      reactions: reactions.map((r: unknown) => {
        if ((r as { person?: unknown } | null)?.person !== hashed) return r;
        changed = true;
        return { ...(r as object), name: ANONYMISED_NAME, person: ANONYMISED_PERSON };
      }),
    };
  });
  return changed ? { value: JSON.stringify(out), changed } : { value: text, changed: false };
}

// A tab's canvas comments with every reaction the person left named Deleted account, wherever a comment thread sits
// in it: the room stamps each reaction's `person` (docs/specs/012-collaboration/comment-reactions.md). Cheap when the
// text never mentions them; one walk of the tab otherwise.
export function anonymiseTabReactions(text: string, hashed: string): Anonymised<string> {
  if (!text.includes(hashed)) return { value: text, changed: false };
  let tab: unknown;
  try {
    tab = JSON.parse(text);
  } catch {
    return { value: text, changed: false };
  }
  let changed = false;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'reactions' && Array.isArray(v)) {
        out[k] = v.map((r: unknown) => {
          if ((r as { person?: unknown } | null)?.person !== hashed) return r;
          changed = true;
          return { ...(r as object), name: ANONYMISED_NAME, person: ANONYMISED_PERSON };
        });
      } else out[k] = walk(v);
    }
    return out;
  };
  const next = walk(tab);
  return changed ? { value: JSON.stringify(next), changed } : { value: text, changed: false };
}

export async function anonymisePlan(
  env: PlanEnv,
  planId: string,
  personId: string,
): Promise<number> {
  const db = env.PLAN_DB;
  const now = Date.now();
  const like = `%${personId}%`;
  const hashed = await itemPersonId(personId);
  const hashLike = `%${hashed}%`;
  const [tabs, items, threads] = await db.batch([
    db
      .prepare(
        `SELECT t.id, t.data, t.rev FROM tabs t JOIN plan_tabs pt ON pt.tab_id = t.id
          WHERE pt.plan_id = ?1 AND (t.data LIKE ?2 OR t.data LIKE ?3)`,
      )
      .bind(planId, like, hashLike),
    db
      .prepare('SELECT id, fields FROM items WHERE plan_id = ? AND fields LIKE ?')
      .bind(planId, like),
    // The cards' comment threads this plan stores: their comments, who started them, who resolved them and the
    // reactions on their comments (the last two by hashed id).
    db
      .prepare(
        `SELECT id, comments, created_by, resolved_by_id FROM card_threads
          WHERE plan_id = ?1
            AND (comments LIKE ?2 OR created_by LIKE ?2 OR comments LIKE ?3 OR resolved_by_id = ?4)`,
      )
      .bind(planId, like, hashLike, hashed),
  ]);
  const writes: D1PreparedStatement[] = [];
  for (const tab of (tabs?.results ?? []) as { id: string; data: string; rev: number }[]) {
    // Their raw id where the tab names them, then the reactions they left on its comments, by hashed id.
    const named = anonymiseJsonText(tab.data, personId);
    const reacted = anonymiseTabReactions(named.value, hashed);
    const { value } = reacted;
    if (named.changed || reacted.changed) {
      writes.push(
        db
          .prepare('UPDATE tabs SET data = ?, rev = ?, updated_at = ? WHERE id = ? AND rev = ?')
          .bind(value, tab.rev + 1, now, tab.id, tab.rev),
      );
    }
  }
  for (const item of (items?.results ?? []) as { id: string; fields: string }[]) {
    const { value, changed } = anonymiseJsonText(item.fields, personId);
    if (changed) {
      writes.push(
        db
          .prepare('UPDATE items SET fields = ? WHERE plan_id = ? AND id = ?')
          .bind(value, planId, item.id),
      );
    }
  }
  type ThreadRow = {
    id: string;
    comments: string;
    created_by: string;
    resolved_by_id: string | null;
  };
  for (const thread of (threads?.results ?? []) as ThreadRow[]) {
    const raw = anonymiseJsonText(thread.comments, personId);
    const comments = anonymiseReactions(raw.value, hashed);
    const by = anonymiseJsonText(thread.created_by, personId);
    const resolver = thread.resolved_by_id === hashed;
    if (raw.changed || comments.changed || by.changed) {
      writes.push(
        db
          .prepare(
            'UPDATE card_threads SET comments = ?, created_by = ? WHERE plan_id = ? AND id = ?',
          )
          .bind(comments.value, by.value, planId, thread.id),
      );
    }
    if (resolver) {
      writes.push(
        db
          .prepare(
            'UPDATE card_threads SET resolved_by = ?, resolved_by_id = ? WHERE plan_id = ? AND id = ?',
          )
          .bind(ANONYMISED_NAME, ANONYMISED_PERSON, planId, thread.id),
      );
    }
  }
  // The cards' history, the cards' makers and last editors and a sheet's last editor name people by their hashed id
  // (docs/specs/026-plan/items.md "Created and Last Edited", "History"): those read Deleted account. A card from
  // before cards held a person names the raw id, matched too. The LIKE narrows to rows that mention them before
  // any JSON is read.
  const names = (col: string) => `(${personIdOf(col)} = ?3 OR ${col} = ?4)`;
  writes.push(
    db
      .prepare(`UPDATE item_history SET by = ?1 WHERE plan_id = ?2 AND by ->> '$.id' = ?3`)
      .bind(ANONYMISED_AUTHOR, planId, hashed),
    db
      .prepare(
        `UPDATE items
            SET created_by = CASE WHEN ${names('created_by')} THEN ?1 ELSE created_by END,
                updated_by = CASE WHEN ${names('updated_by')} THEN ?1 ELSE updated_by END
          WHERE plan_id = ?2
            AND (created_by LIKE ?5 OR updated_by LIKE ?5 OR created_by = ?4 OR updated_by = ?4)
            AND (${names('created_by')} OR ${names('updated_by')})`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashed, personId, hashLike),
    db
      .prepare(
        `UPDATE sheets SET updated_by = ?1
          WHERE plan_id = ?2 AND updated_by LIKE ?4 AND ${personIdOf('updated_by')} = ?3`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashed, hashLike),
    db
      .prepare(
        'UPDATE agent_changesets SET author_id = ?, author_name = ? WHERE plan_id = ? AND author_id = ?',
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, planId, personId),
    db
      .prepare('UPDATE plan SET owner_id = ? WHERE id = ? AND owner_id = ?')
      .bind(ANONYMISED_PERSON, planId, personId),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
