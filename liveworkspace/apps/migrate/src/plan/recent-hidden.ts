// Hide from Recent (livediagram/docs/specs/013-workspace/hide-from-recent.md): the old site kept the documents each
// person hid in their preferences blob (`recentExcludedIds`, a list of document ids); the index keeps it on the
// person's own `opens` row (`hidden`). This reads every blob once, through the owner map, into who hid each document,
// so the document pass marks the rows it writes (docs/migration.md, step 2.3).
import type { PlanContext } from './context.ts';

type Row = Record<string, string | number | null>;

/** The preference key the old site kept the hidden ids under. Not carried as a setting (accounts.ts). */
export const RECENT_EXCLUDED_KEY = 'recentExcludedIds';

/** Old document id to the new ids of the people who hid it from Recent. */
export function readHiddenFromRecent(ctx: PlanContext): Map<string, Set<string>> {
  const hidden = new Map<string, Set<string>>();
  const rows = ctx.snapshot.prepare(
    'SELECT owner_id, prefs FROM user_preferences ORDER BY owner_id',
  );
  for (const r of rows.iterate() as Iterable<Row>) {
    let ids: unknown;
    try {
      ids = (JSON.parse(String(r.prefs)) as Record<string, unknown> | null)?.[RECENT_EXCLUDED_KEY];
    } catch {
      continue;
    }
    if (!Array.isArray(ids)) continue;
    const person = ctx.owners.ownerOf(String(r.owner_id));
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      let people = hidden.get(id);
      if (!people) hidden.set(id, (people = new Set()));
      people.add(person);
    }
  }
  return hidden;
}
