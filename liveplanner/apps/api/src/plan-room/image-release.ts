// Pictures a card no longer holds leave storage (docs/specs/026-plan/items.md "Images in use", "Removed pictures";
// liveworkspace/docs/specs/006-media/media.md "Releases"). The plan sees every write to its cards, whoever made it
// (the editor, a rule's Clear Field, the MCP, the CLI, an import, a revert), so its own triggers note each picture a
// write took off a card (an Attachments entry, or an Image field value the plan holds a grant for, one of a Several
// Images list among them) in `image_releases`, in the write's own transaction. The outbox's drain gives each a moment
// once the plan's report to the media service has landed (stampImageReleases), IMAGE_RELEASE_GRACE_MS on; the room's
// alarm then asks the service to release each one nothing in the plan still holds (releaseDueImages). An undo or a
// re-add within the grace puts the id back on a card, so the check finds it and the picture stays. The list is stored,
// so the grace survives the object's restart (restoreContentState reads the next moment back).

import { mediaClient } from '../media';
import type { PlanEnv } from '../types';

// How long a removed picture waits before it is released: an undo within it brings the picture back whole.
export const IMAGE_RELEASE_GRACE_MS = 15 * 60 * 1000;
// The most releases one wake asks for; the rest wait for the next wake, a second on.
export const IMAGE_RELEASES_PER_WAKE = 20;
// A release the service could not answer waits a minute, doubling to an hour, and is dropped after this many tries
// (the service's daily sweep is the backstop).
export const IMAGE_RELEASE_RETRY_MS = 60 * 1000;
export const IMAGE_RELEASE_RETRY_MAX_MS = 60 * 60 * 1000;
export const IMAGE_RELEASE_ATTEMPTS_MAX = 12;
// How long one release may hold the room's doors (below): an answer slower than this is a failure, tried again later.
// Well under the runtime's 30 s limit on blockConcurrencyWhile.
export const IMAGE_RELEASE_TIMEOUT_MS = 5_000;

/** Runs `work` with the room's doors shut: no request or socket message is delivered until it settles. The room
 *  passes its `blockConcurrencyWhile`; alone (tests, scripts), the work just runs. */
export type ReleaseHold = <T>(work: () => Promise<T>) => Promise<T>;
const NO_HOLD: ReleaseHold = (work) => work();

// The media service's answer, or 'slow' once IMAGE_RELEASE_TIMEOUT_MS passes.
function withinTimeout<T>(answer: Promise<T>): Promise<T | 'slow'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'slow'>((resolve) => {
    timer = setTimeout(() => resolve('slow'), IMAGE_RELEASE_TIMEOUT_MS);
  });
  return Promise.race([answer, late]).finally(() => clearTimeout(timer));
}
// The longest id the triggers note: the service's ids are UUIDs (image-grants.ts IMAGE_ID_MAX).
const ID_MAX = 200;

// The pictures one card's fields (`fields`, a JSON text) hold: each Attachments entry's id, and each text value, or
// text in a list value, that the plan (`plan`) holds a grant for. Text that is not JSON holds none, so a write is
// never refused here.
function heldIdsSql(fields: string, plan: string): string {
  const json = `CASE WHEN json_valid(${fields}) THEN ${fields} ELSE '{}' END`;
  const granted = `(SELECT image_id FROM card_image_grants WHERE plan_id = ${plan})`;
  return `SELECT json_extract(a.value, '$.id') AS id
       FROM json_each(CASE WHEN ${fields} LIKE '%"attachments"%' THEN ${json} ELSE '{}' END, '$.attachments') AS a
      WHERE a.type = 'object'
     UNION
     SELECT f.value FROM json_each(${json}) AS f
      WHERE f.type = 'text' AND f.value IN ${granted}
     UNION
     SELECT v.value FROM json_each(${json}) AS f,
            json_each(CASE WHEN f.type = 'array' THEN f.value ELSE '[]' END) AS v
      WHERE f.type = 'array' AND v.type = 'text' AND v.value IN ${granted}`;
}

// A removed id noted again (taken off, put back, taken off) waits a fresh grace.
const noteRemoved = (from: string) => `
  INSERT INTO image_releases (plan_id, image_id, due_at, attempts)
  SELECT OLD.plan_id, id, NULL, 0 FROM (${heldIdsSql('OLD.fields', 'OLD.plan_id')})
   WHERE typeof(id) = 'text' AND length(id) BETWEEN 1 AND ${ID_MAX} ${from}
  ON CONFLICT (plan_id, image_id) DO UPDATE SET due_at = NULL, attempts = 0;`;

// Its own schema step (plan-schema.ts V35). Every statement is IF NOT EXISTS. The triggers fire only for a card that
// held attachments or while the plan holds a grant, as the `images` outbox key's do (image-refs.ts).
export const IMAGE_RELEASES_SCHEMA = `
CREATE TABLE IF NOT EXISTS image_releases (
  plan_id  TEXT    NOT NULL,
  image_id TEXT    NOT NULL,
  due_at   INTEGER NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS image_releases_due ON image_releases (due_at);
CREATE TRIGGER IF NOT EXISTS image_releases_update AFTER UPDATE OF fields ON items
WHEN OLD.fields LIKE '%"attachments"%'
  OR EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = OLD.plan_id)
BEGIN
  ${noteRemoved(`AND id NOT IN (${heldIdsSql('NEW.fields', 'NEW.plan_id')})`)}
END;
CREATE TRIGGER IF NOT EXISTS image_releases_delete AFTER DELETE ON items
WHEN OLD.fields LIKE '%"attachments"%'
  OR EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = OLD.plan_id)
BEGIN
  ${noteRemoved('')}
END;
`;

type Sql = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

// The plan's report has landed (or there was nothing to send): every removal noted since waits its grace from now.
export async function stampImageReleases(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  planId: string,
  now: number,
): Promise<void> {
  await env.PLAN_DB.prepare(
    'UPDATE image_releases SET due_at = ? WHERE plan_id = ? AND due_at IS NULL',
  )
    .bind(now + IMAGE_RELEASE_GRACE_MS, planId)
    .run();
}

// When the next release is due, or null when none waits a moment (none noted, or none stamped yet: the drain that
// stamps them comes first). Null too for a plan whose schema predates the table.
export function nextImageReleaseAt(sql: Sql): number | null {
  try {
    const row = sql.exec('SELECT MIN(due_at) AS at FROM image_releases').toArray()[0];
    return typeof row?.at === 'number' ? row.at : null;
  } catch {
    return null;
  }
}

// Whether anything the plan keeps still names the picture: a card (in the Trash too), a tab, an agent's changeset
// (a revert puts it back), a copy's note the media service has not taken yet (copy-image-claims.ts: the copy may still
// show it) or a snapshot (a revert puts it back). A plain text match, so it errs on keeping: a card naming the id
// anywhere keeps it. A snapshot's body is cut into chunks, so each is read with the start of the next.
export async function planStillHolds(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  planId: string,
  imageId: string,
): Promise<boolean> {
  const held = await env.PLAN_DB.prepare(
    `SELECT EXISTS (SELECT 1 FROM items WHERE plan_id = ?1 AND instr(fields, ?2) > 0)
         OR EXISTS (SELECT 1 FROM tabs WHERE instr(data, ?2) > 0)
         OR EXISTS (SELECT 1 FROM agent_changeset_parts WHERE instr(data, ?2) > 0)
         OR EXISTS (SELECT 1 FROM copy_image_claims WHERE plan_id = ?1 AND instr(images, ?2) > 0) AS held`,
  )
    .bind(planId, imageId)
    .first<{ held: number }>();
  if (held?.held === 1) return true;
  const snapshots = await env.PLAN_DB.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'snapshot_chunks'",
  ).first<{ present: number }>();
  if (!snapshots) return false;
  const inSnapshot = await env.PLAN_DB.prepare(
    `SELECT 1 AS present FROM snapshot_chunks a
       LEFT JOIN snapshot_chunks b ON b.snapshot_id = a.snapshot_id AND b.seq = a.seq + 1
      WHERE instr(a.data || substr(COALESCE(b.data, ''), 1, ?2), ?1) > 0 LIMIT 1`,
  )
    .bind(imageId, ID_MAX * 2)
    .first<{ present: number }>();
  return !!inSnapshot;
}

export type ReleaseRun = { released: number; kept: number; held: number; retried: number };

// The releases due now, at most IMAGE_RELEASES_PER_WAKE: one the plan still holds is dropped (it stays); the rest
// are asked of the media service, which deletes only what nothing else places. An answer, released or kept, ends
// the row; a failure waits and tries again. Without the service there is nobody to ask: the rows go.
//
// The check and the ask run together under `hold` (the room's blockConcurrencyWhile), so no write can put the picture
// back on a card between the plan saying nothing holds it and the service deleting it: a re-add waits at the door
// until the answer is in, and then lands on a picture that is either kept or gone, never one deleted under it. Each
// hold lasts at most IMAGE_RELEASE_TIMEOUT_MS, and a wake stops at its first slow answer (the rest stay due). After a released answer the plan checks again, and a picture it holds
// once more (which the hold rules out) is logged as an error rather than passed over in silence.
export async function releaseDueImages(
  env: PlanEnv,
  planId: string,
  now: number,
  hold: ReleaseHold = NO_HOLD,
): Promise<ReleaseRun> {
  const run: ReleaseRun = { released: 0, kept: 0, held: 0, retried: 0 };
  const due = await env.PLAN_DB.prepare(
    `SELECT image_id, attempts FROM image_releases
      WHERE plan_id = ? AND due_at IS NOT NULL AND due_at <= ? ORDER BY due_at, image_id LIMIT ?`,
  )
    .bind(planId, now, IMAGE_RELEASES_PER_WAKE)
    .all<{ image_id: string; attempts: number }>();
  const rows = due.results ?? [];
  if (rows.length === 0) return run;
  const media = mediaClient(env);
  const done: string[] = [];
  for (const { image_id: id, attempts } of rows) {
    if (!media) {
      done.push(id);
      continue;
    }
    const answer = await hold(async () => {
      if (await planStillHolds(env, planId, id)) return 'held' as const;
      const asked = await withinTimeout(media.release(id, planId)).catch(() => null);
      if (
        asked !== 'slow' &&
        asked?.ok &&
        asked.value.released &&
        (await planStillHolds(env, planId, id))
      )
        console.error('[media] released a picture the plan holds again', { planId });
      return asked;
    });
    if (answer === 'held') {
      run.held++;
      done.push(id);
      continue;
    }
    if (answer !== 'slow' && answer?.ok) {
      if (answer.value.released) run.released++;
      else run.kept++;
      done.push(id);
      continue;
    }
    if (attempts + 1 >= IMAGE_RELEASE_ATTEMPTS_MAX) {
      console.warn('[media] release given up', { planId, attempts: attempts + 1 });
      done.push(id);
      continue;
    }
    run.retried++;
    const wait = Math.min(IMAGE_RELEASE_RETRY_MS * 2 ** attempts, IMAGE_RELEASE_RETRY_MAX_MS);
    await env.PLAN_DB.prepare(
      'UPDATE image_releases SET due_at = ?, attempts = ? WHERE plan_id = ? AND image_id = ?',
    )
      .bind(now + wait, attempts + 1, planId, id)
      .run();
    // A service that stalls is asked nothing more this wake, so the room's doors shut for at most one timeout.
    if (answer === 'slow') break;
  }
  if (done.length > 0)
    await env.PLAN_DB.prepare(
      // A row noted again while the run asked (its due moment cleared) stays for its own grace.
      `DELETE FROM image_releases WHERE plan_id = ? AND due_at IS NOT NULL
         AND image_id IN (SELECT value FROM json_each(?))`,
    )
      .bind(planId, JSON.stringify(done))
      .run();
  console.info('[media] releases', { planId, ...run });
  return run;
}
