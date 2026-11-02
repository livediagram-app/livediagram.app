// The component library (docs/specs/009-elements/components.md "Sharing, collaboration and storage"), in the design's
// own SQLite: one `components` row per main (its JSON and the time it was stored), and `component_refs`, which mains
// each tab's instances use. The refs are a projection of the instances inside `tabs.data`, kept like `image_refs`:
// statements appended to the batch that writes the body, so they land in the same transaction as the body they
// mirror, and pruned with the tab. No foreign keys: a dangling row (its tab gone) is ignored by every reader.

import {
  MAX_COMPONENTS,
  componentRefIdsFromData,
  isValidDesignComponent,
  type DesignComponent,
} from '@livedesign/design';
import type { DesignEnv } from '../types';

type ComponentRow = { data: string };

// A stored row as a main, or null for one that no longer parses as one (never written by this module).
function mainOf(row: ComponentRow): DesignComponent | null {
  try {
    const main: unknown = JSON.parse(row.data);
    return isValidDesignComponent(main) ? main : null;
  } catch {
    return null;
  }
}

function mainsOf(rows: readonly ComponentRow[]): DesignComponent[] {
  return rows.map(mainOf).filter((m): m is DesignComponent => m !== null);
}

/** Every main in the library, or (with `tabIds`) only the mains those tabs' instances use, by `component_refs`. */
export async function readComponents(
  env: DesignEnv,
  opts: { tabIds?: readonly string[] } = {},
): Promise<DesignComponent[]> {
  const db = env.DESIGN_DB;
  if (opts.tabIds === undefined) {
    const { results } = await db
      .prepare('SELECT data FROM components ORDER BY id')
      .all<ComponentRow>();
    return mainsOf(results);
  }
  if (opts.tabIds.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT c.data FROM components c
        WHERE c.id IN (SELECT component_id FROM component_refs
                        WHERE tab_id IN (SELECT value FROM json_each(?1)))
        ORDER BY c.id`,
    )
    .bind(JSON.stringify(opts.tabIds))
    .all<ComponentRow>();
  return mainsOf(results);
}

/** The mains with these ids that the library holds (a body in hand names them: a drawing, a shared tab). */
export async function readComponentsById(
  env: DesignEnv,
  ids: readonly string[],
): Promise<DesignComponent[]> {
  if (ids.length === 0) return [];
  const { results } = await env.DESIGN_DB.prepare(
    'SELECT data FROM components WHERE id IN (SELECT value FROM json_each(?1)) ORDER BY id',
  )
    .bind(JSON.stringify(ids))
    .all<ComponentRow>();
  return mainsOf(results);
}

/** One stored main with the exact JSON it is stored as (the compare-and-swap's expected value), or null. */
export async function readComponentRow(
  env: DesignEnv,
  id: string,
): Promise<{ main: DesignComponent; data: string } | null> {
  const row = await env.DESIGN_DB.prepare('SELECT data FROM components WHERE id = ?')
    .bind(id)
    .first<ComponentRow>();
  if (!row) return null;
  const main = mainOf(row);
  return main ? { main, data: row.data } : null;
}

/** The tabs whose instances use a main, in id order: who a `component` op is for. */
export async function componentTabIds(env: DesignEnv, componentId: string): Promise<string[]> {
  const { results } = await env.DESIGN_DB.prepare(
    'SELECT tab_id FROM component_refs WHERE component_id = ? ORDER BY tab_id',
  )
    .bind(componentId)
    .all<{ tab_id: string }>();
  return results.map((r) => r.tab_id);
}

/** Whether any tab but `tabId` uses a main: a tab-scoped Editor may change only a main no other tab draws. */
export async function componentUsedOutside(
  env: DesignEnv,
  componentId: string,
  tabId: string,
): Promise<boolean> {
  const row = await env.DESIGN_DB.prepare(
    'SELECT 1 AS used FROM component_refs WHERE component_id = ? AND tab_id <> ? LIMIT 1',
  )
    .bind(componentId, tabId)
    .first<{ used: number }>();
  return row !== null;
}

/** Create or replace a main, within MAX_COMPONENTS: false (nothing written) when it is new and the library is full. */
export async function putComponent(env: DesignEnv, main: DesignComponent): Promise<boolean> {
  const res = await env.DESIGN_DB.prepare(
    `INSERT INTO components (id, data, updated_at)
     SELECT ?1, ?2, ?3
      WHERE EXISTS (SELECT 1 FROM components WHERE id = ?1)
         OR (SELECT COUNT(*) FROM components) < ?4
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(main.id, JSON.stringify(main), main.updatedAt, MAX_COMPONENTS)
    .run();
  return res.meta.changes > 0;
}

/** A library write is a change to the design: its last save moves, so its preview, Drive file and listing follow. */
export async function touchDesignSaved(
  env: DesignEnv,
  designId: string,
  now: number,
): Promise<void> {
  await env.DESIGN_DB.prepare('UPDATE design SET saved_at = ? WHERE id = ?')
    .bind(now, designId)
    .run();
}

/** Replace a main only while it is still stored as `expectedData` (a patch's read-modify-write); whether it was. */
export async function swapComponent(
  env: DesignEnv,
  main: DesignComponent,
  expectedData: string,
): Promise<boolean> {
  const res = await env.DESIGN_DB.prepare(
    'UPDATE components SET data = ?, updated_at = ? WHERE id = ? AND data = ?',
  )
    .bind(JSON.stringify(main), main.updatedAt, main.id, expectedData)
    .run();
  return res.meta.changes > 0;
}

/** Upsert mains that came with a body from elsewhere (a shared tab taken in): each lands only where the stored
 *  `updated_at` is older or absent, and a new one only while the library has room. */
export function componentUpsertLaterStatements(
  env: DesignEnv,
  mains: readonly DesignComponent[],
): D1PreparedStatement[] {
  return mains.map((main) =>
    env.DESIGN_DB.prepare(
      `INSERT INTO components (id, data, updated_at)
       SELECT ?1, ?2, ?3
        WHERE EXISTS (SELECT 1 FROM components WHERE id = ?1)
           OR (SELECT COUNT(*) FROM components) < ?4
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        WHERE excluded.updated_at > components.updated_at`,
    ).bind(main.id, JSON.stringify(main), main.updatedAt, MAX_COMPONENTS),
  );
}

/** Every main of a library into a new design's (a copy): its rows as they are. */
export function componentInsertStatements(
  env: DesignEnv,
  mains: readonly DesignComponent[],
): D1PreparedStatement[] {
  if (mains.length === 0) return [];
  return [
    env.DESIGN_DB.prepare(
      `INSERT OR REPLACE INTO components (id, data, updated_at)
       SELECT value ->> '$.id', value, value ->> '$.updatedAt' FROM json_each(?1)`,
    ).bind(JSON.stringify(mains.slice(0, MAX_COMPONENTS))),
  ];
}

// ---------- component_refs, beside every tab write ----------------------------------------------------------------

/** A body replace: drop the tab's refs the new body no longer has, then add the ones it does. */
export function componentRefReplaceStatements(
  env: DesignEnv,
  tabId: string,
  componentIds: readonly string[],
): D1PreparedStatement[] {
  return [
    env.DESIGN_DB.prepare(
      'DELETE FROM component_refs WHERE tab_id = ?1 AND component_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, JSON.stringify(componentIds)),
    ...componentRefAddStatements(env, tabId, componentIds),
  ];
}

/** Add only: for a write that may have lost a race (a participant swap), where deleting could drop a winner's ref. */
export function componentRefAddStatements(
  env: DesignEnv,
  tabId: string,
  componentIds: readonly string[],
): D1PreparedStatement[] {
  if (componentIds.length === 0) return [];
  return [
    env.DESIGN_DB.prepare(
      'INSERT OR IGNORE INTO component_refs (tab_id, component_id) SELECT ?1, value FROM json_each(?2)',
    ).bind(tabId, JSON.stringify(componentIds)),
  ];
}

/** The refs of a stored body (`tabs.data` JSON), replaced. */
export function componentRefReplaceFromData(
  env: DesignEnv,
  tabId: string,
  data: string,
): D1PreparedStatement[] {
  return componentRefReplaceStatements(env, tabId, componentRefIdsFromData(data));
}

/** A tab gone: its refs go with it. */
export function componentRefPruneTabStatement(env: DesignEnv, tabId: string): D1PreparedStatement {
  return env.DESIGN_DB.prepare('DELETE FROM component_refs WHERE tab_id = ?').bind(tabId);
}
