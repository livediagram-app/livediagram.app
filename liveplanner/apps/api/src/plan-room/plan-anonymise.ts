// A closed account's name off a plan that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which plans name them (POST /api/internal/people/:id/purge), and each plan's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments,
// cards, assignments and reactions in each tab, the cards' own fields, comment threads and history and who made or changed them, the changesets they
// wrote, the sheets they last edited, who connected the plan to GitHub, and the plan's owner when it was their team plan. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.
//
// The person is every id they had: the account's and the guests merged into it (the door's `guests`, Work Tracker
// 1241), each by raw id and by hashed `itemPersonId`, so what they left as a guest reads Deleted account as theirs does.

import {
  ANONYMISED_NAME,
  ANONYMISED_PERSON,
  anonymiseJsonText,
  anonymiseReactionsText,
  closedPersonIds,
  isAnySql,
  mentionsAnySql,
  type Anonymised,
} from '@liveworkspace/index-app';
import { itemPersonId } from '@liveplanner/items';
import { ANONYMISED_ITEM_PERSON } from '../db/items';
import { FORGET_ASSISTANTS_SQL } from './known-assistants';
import { clearSnapshotAuthors } from '@liveworkspace/snapshots/server';
import type { PlanEnv } from '../types';

// A closed account as a card, its history and a sheet name them.
const ANONYMISED_AUTHOR = JSON.stringify(ANONYMISED_ITEM_PERSON);

// The SQL that reads a JSON person column's hashed id, or nothing when the column is not JSON (a pre-person row
// holds the raw id), so one odd row can't fail the whole batch.
const personIdOf = (col: string) => `CASE WHEN json_valid(${col}) THEN ${col} ->> '$.id' END`;

// The person's names as whole words, longest first (so a name holding a shorter one goes whole): never a run of
// letters inside another word ("Al" in "Already") or a longer name ("Al" in "Alan").
const regexEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function namePattern(names: ReadonlySet<string>): RegExp {
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(regexEscape);
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
}

// An Audit Trail run's body (docs/specs/026-plan/automations.md "Runs, limits and loops") with the person's lines,
// the trigger they made, naming Deleted account: the line's person, and their name in its text and the run's other
// lines (an Assign or a Send Email to whoever triggered it). Unchanged when no line is theirs.
export function anonymiseRun(text: string, hashes: readonly string[]): Anonymised<string> {
  if (!hashes.some((h) => text.includes(h))) return { value: text, changed: false };
  const theirs = (id: unknown) => typeof id === 'string' && hashes.includes(id);
  let run: { steps?: unknown };
  try {
    run = JSON.parse(text) as { steps?: unknown };
  } catch {
    return { value: text, changed: false };
  }
  if (!run || !Array.isArray(run.steps)) return { value: text, changed: false };
  type Line = { by?: { id?: unknown; name?: unknown }; text?: unknown };
  const lines = run.steps as Line[];
  const names = new Set<string>();
  for (const line of lines)
    if (theirs(line?.by?.id) && typeof line.by!.name === 'string' && line.by!.name)
      names.add(line.by!.name);
  if (!lines.some((l) => theirs(l?.by?.id))) return { value: text, changed: false };
  const pattern = names.size > 0 ? namePattern(names) : null;
  const steps = lines.map((line) => {
    if (!line || typeof line !== 'object') return line;
    const said = line.text;
    const renamed =
      typeof said === 'string' && pattern ? said.replace(pattern, ANONYMISED_NAME) : null;
    return {
      ...line,
      ...(renamed !== null ? { text: renamed } : {}),
      ...(theirs(line.by?.id) ? { by: ANONYMISED_ITEM_PERSON } : {}),
    };
  });
  return { value: JSON.stringify({ ...run, steps }), changed: true };
}

export async function anonymisePlan(
  env: PlanEnv,
  planId: string,
  personId: string,
  guestIds: readonly string[] = [],
): Promise<number> {
  const db = env.PLAN_DB;
  const now = Date.now();
  // Every id they had, raw and hashed, each list bound as one JSON parameter (`instr` over it, never a bound LIKE:
  // Durable Object SQLite refuses a LIKE pattern over 50 bytes).
  const ids = closedPersonIds(personId, guestIds);
  const hashes = await Promise.all(ids.map((id) => itemPersonId(id)));
  const idList = JSON.stringify(ids);
  const hashList = JSON.stringify(hashes);
  const needles = JSON.stringify([...ids, ...hashes]);
  const [tabs, items, threads, runs] = await db.batch([
    db
      .prepare(
        `SELECT t.id, t.data, t.rev FROM tabs t JOIN plan_tabs pt ON pt.tab_id = t.id
          WHERE pt.plan_id = ?1 AND ${mentionsAnySql('t.data', '?2')}`,
      )
      .bind(planId, needles),
    db
      .prepare(
        `SELECT id, fields FROM items WHERE plan_id = ?1 AND ${mentionsAnySql('fields', '?2')}`,
      )
      .bind(planId, idList),
    // The cards' comment threads this plan stores: their comments, who started them, who resolved them and the
    // reactions on their comments (the last two by hashed id).
    db
      .prepare(
        `SELECT id, comments, created_by, resolved_by_id FROM card_threads
          WHERE plan_id = ?1
            AND (${mentionsAnySql('comments', '?2')} OR ${mentionsAnySql('created_by', '?2')}
                 OR ${mentionsAnySql('comments', '?3')} OR ${isAnySql('resolved_by_id', '?3')})`,
      )
      .bind(planId, idList, hashList),
    // The Audit Trail's runs a change of theirs started.
    db
      .prepare(`SELECT id, body FROM automation_runs WHERE ${mentionsAnySql('body', '?1')}`)
      .bind(hashList),
  ]);
  const writes: D1PreparedStatement[] = [];
  for (const tab of (tabs?.results ?? []) as { id: string; data: string; rev: number }[]) {
    // Their raw id where the tab names them, then the reactions they left on its comments, by hashed id.
    const named = anonymiseJsonText(tab.data, ids);
    const reacted = anonymiseReactionsText(named.value, hashes);
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
    const { value, changed } = anonymiseJsonText(item.fields, ids);
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
    const raw = anonymiseJsonText(thread.comments, ids);
    const comments = anonymiseReactionsText(raw.value, hashes);
    const by = anonymiseJsonText(thread.created_by, ids);
    const resolver = thread.resolved_by_id !== null && hashes.includes(thread.resolved_by_id);
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
  for (const run of (runs?.results ?? []) as { id: string; body: string }[]) {
    const { value, changed } = anonymiseRun(run.body, hashes);
    if (changed)
      writes.push(
        db.prepare('UPDATE automation_runs SET body = ? WHERE id = ?').bind(value, run.id),
      );
  }
  // The cards' history, the cards' makers and last editors and a sheet's last editor name people by their hashed id
  // (docs/specs/026-plan/items.md "Created and Last Edited", "History"): those read Deleted account. A card from
  // before cards held a person names the raw id, matched too. The LIKE narrows to rows that mention them before
  // any JSON is read.
  const names = (col: string) => `(${isAnySql(personIdOf(col), '?3')} OR ${isAnySql(col, '?4')})`;
  writes.push(
    db
      .prepare(
        `UPDATE item_history SET by = ?1 WHERE plan_id = ?2 AND ${isAnySql("by ->> '$.id'", '?3')}`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashList),
    db
      .prepare(
        `UPDATE items
            SET created_by = CASE WHEN ${names('created_by')} THEN ?1 ELSE created_by END,
                updated_by = CASE WHEN ${names('updated_by')} THEN ?1 ELSE updated_by END
          WHERE plan_id = ?2
            AND (${mentionsAnySql('created_by', '?3')} OR ${mentionsAnySql('updated_by', '?3')}
                 OR ${isAnySql('created_by', '?4')} OR ${isAnySql('updated_by', '?4')})
            AND (${names('created_by')} OR ${names('updated_by')})`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashList, idList),
    db
      .prepare(
        `UPDATE sheets SET updated_by = ?1
          WHERE plan_id = ?2 AND ${mentionsAnySql('updated_by', '?3')}
            AND ${isAnySql(personIdOf('updated_by'), '?3')}`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashList),
    // Who connected the plan to GitHub (docs/specs/026-plan/github-pull-requests.md "Connecting a repository").
    db
      .prepare(
        `UPDATE github_connection SET connected_by = ?1
          WHERE plan_id = ?2 AND ${isAnySql(personIdOf('connected_by'), '?3')}`,
      )
      .bind(ANONYMISED_AUTHOR, planId, hashList),
    // A rule's Made by and Edited by (docs/specs/026-plan/automations.md "A rule"), and the triggers of theirs still
    // queued or held by a Wait, which a run's Who Did It and trigger line read.
    ...(['made', 'edited'] as const).map((stamp) =>
      db
        .prepare(
          `UPDATE automation_rules SET body = json_set(body, '$.${stamp}.by', json(?1))
            WHERE ${isAnySql(`body ->> '$.${stamp}.by.id'`, '?2')}`,
        )
        .bind(ANONYMISED_AUTHOR, hashList),
    ),
    ...(['automation_queue', 'automation_waiting'] as const).map((table) =>
      db
        .prepare(
          `UPDATE ${table} SET event = json_set(event, '$.by', json(?1))
            WHERE ${isAnySql("event ->> '$.by.id'", '?2')}`,
        )
        .bind(ANONYMISED_AUTHOR, hashList),
    ),
    db
      .prepare(
        `UPDATE agent_changesets SET author_id = ?1, author_name = ?2
          WHERE plan_id = ?3 AND ${isAnySql('author_id', '?4')}`,
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, planId, idList),
    // Their AI assistants the plan remembered (docs/specs/026-plan/items.md "Who it can be handed to").
    db.prepare(FORGET_ASSISTANTS_SQL).bind(hashList),
    // Their calendar feed on the plan (docs/specs/026-plan/calendar-feed.md "The feed link").
    db
      .prepare(`DELETE FROM calendar_feeds WHERE plan_id = ?1 AND ${isAnySql('person_id', '?2')}`)
      .bind(planId, idList),
    db
      .prepare(`UPDATE plan SET owner_id = ?1 WHERE id = ?2 AND ${isAnySql('owner_id', '?3')}`)
      .bind(ANONYMISED_PERSON, planId, idList),
  );
  const results = await db.batch(writes);
  // The snapshots they took here (liveworkspace/docs/specs/014-snapshots "When an account closes", Work Tracker 1310):
  // the author only; the snapshot is the item's and stays.
  const snapshots = await clearSnapshotAuthors(db, ids, {
    id: ANONYMISED_PERSON,
    name: ANONYMISED_NAME,
  });
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0) + snapshots;
}
