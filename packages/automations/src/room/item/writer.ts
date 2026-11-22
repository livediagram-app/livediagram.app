// Who is writing the item's tables right now, for the SQL triggers (blueprint item-engine.md "Tables"). One row in
// `automation_writer` while a window is open: a rule's step (its events carry the rule and the chain, and its
// writes are no edit), a revert (nothing is queued or stamped at all), or a person's tab write (Tab Added and Tab
// Removed carry who). A window closes itself after ITEM_WRITER_MS, so a room that died inside one never leaves the
// item deaf.
//
// Windows nest and overlap: a person's tab write can land while a rule's step awaits. The room keeps its open
// windows in order, in memory per storage (one Durable Object, one isolate), and the row always holds the newest
// still open; a window closing puts back the newest one left, with its own `until`, or deletes the row when none is.
// So the rule's writes after the person's are the rule's again, whichever window closes first.
import type { ItemEvent } from '../../item';
import type { Sql } from '../sql';

export const ITEM_WRITER_MS = 60_000;

export interface ItemWriter {
  // Merged into each event the triggers queue.
  who?: Pick<ItemEvent, 'by' | 'role' | 'rule' | 'chain' | 'cross'>;
  // A rule's own write: not an edit.
  own?: boolean;
  // Nothing is queued or stamped (a revert).
  silent?: boolean;
}

// One open window: what it says and when it lapses.
type OpenWindow = { writer: ItemWriter; until: number };

// The open windows of each storage, oldest first.
const open = new WeakMap<Sql, OpenWindow[]>();

function writeRow(sql: Sql, writer: ItemWriter, until: number): void {
  sql.exec(
    `INSERT INTO automation_writer (id, who, own, silent, until) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET who = excluded.who, own = excluded.own, silent = excluded.silent,
       until = excluded.until`,
    JSON.stringify(writer.who ?? {}),
    writer.own ? 1 : 0,
    writer.silent ? 1 : 0,
    until,
  );
}

export function markItemWriter(sql: Sql, writer: ItemWriter, now = Date.now()): void {
  writeRow(sql, writer, now + ITEM_WRITER_MS);
}

export function clearItemWriter(sql: Sql): void {
  sql.exec('DELETE FROM automation_writer');
}

// A write inside a step from another app (cross-app.md "The door": the target's own route run in a window that
// carries the chain) stays that step's: its events keep the chain, as the automation's, and are no edit, whatever
// window the route opens for its person. A silent window stays silent.
function inChain(windows: readonly OpenWindow[], writer: ItemWriter): ItemWriter {
  if (writer.silent || writer.who?.cross) return writer;
  const outer = windows.findLast((w) => w.writer.who?.cross)?.writer.who;
  if (!outer?.cross) return writer;
  return { ...writer, own: true, who: { ...writer.who, role: 'automation', cross: outer.cross } };
}

/** The chain of the step from another app whose window is open now, if any: an event queued by hand inside it (not
 *  through the SQL triggers) carries it too. */
export function openChain(sql: Sql): ItemWriter['who'] | undefined {
  const outer = open.get(sql)?.findLast((w) => w.writer.who?.cross && w.until > Date.now());
  return outer?.writer.who;
}

/** `write` run inside the writer's window, closed whatever comes of it. `fed` false (no rule hears a kind the SQL
 *  triggers feed, so nothing would read the window): `write` alone, no statement run. */
export async function withItemWriter<T>(
  sql: Sql,
  writer: ItemWriter,
  write: () => Promise<T> | T,
  fed = true,
): Promise<T> {
  if (!fed) return write();
  let windows = open.get(sql);
  if (!windows) open.set(sql, (windows = []));
  const mine: OpenWindow = { writer: inChain(windows, writer), until: Date.now() + ITEM_WRITER_MS };
  windows.push(mine);
  writeRow(sql, mine.writer, mine.until);
  try {
    return await write();
  } finally {
    const newest = windows[windows.length - 1] === mine;
    windows.splice(windows.indexOf(mine), 1);
    // An older window closing leaves the newest one's row as it is. Else the newest still open stands again (a
    // lapsed one stays closed, and its own close finds it gone); with none open, the row goes.
    if (newest) {
      const now = Date.now();
      const back = windows.findLast((w) => w.until > now);
      if (back) writeRow(sql, back.writer, back.until);
      else clearItemWriter(sql);
    }
    if (windows.length === 0) open.delete(sql);
  }
}
