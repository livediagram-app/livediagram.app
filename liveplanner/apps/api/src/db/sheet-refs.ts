// The sheet reference index (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint sheet-store.md
// "Deleting a sheet"). Every tab write replaces the tab's rows: one per Sheet element's `sheetId` and per copy not yet
// made's `copyOf`. As a row goes or comes, the sheet_refs triggers settle its sheet: unreferenced from then
// (`unreferenced_since`), deleted at once when the editor deleted it with its element, referenced again; an
// unreferenced sheet otherwise waits to expire (sheet-sweep.ts).
import type { Element } from '@liveplanner/project';
import type { PlanEnv } from '../types';

// A sheet id is unique only in its project (a copied project keeps them), so a reference counts only through a
// tab of the sheet's own project.
const REFERENCED = `EXISTS (SELECT 1 FROM sheet_refs r JOIN plan_tabs dt ON dt.tab_id = r.tab_id
  WHERE r.sheet_id = sheets.id AND dt.plan_id = sheets.plan_id)`;

// The sheet ids a tab's elements reference.
export function sheetRefIds(elements: readonly Element[]): string[] {
  const out = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-sheet' || !el.planSheet) continue;
    if (el.planSheet.sheetId) out.add(el.planSheet.sheetId);
    if (el.planSheet.copyOf) out.add(el.planSheet.copyOf);
  }
  return [...out];
}

export function sheetRefReplaceStatements(
  env: PlanEnv,
  tabId: string,
  ids: readonly string[],
): D1PreparedStatement[] {
  const json = JSON.stringify(ids);
  return [
    env.PLAN_DB.prepare(
      'DELETE FROM sheet_refs WHERE tab_id = ?1 AND sheet_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, json),
    ...(ids.length
      ? [
          env.PLAN_DB.prepare(
            'INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?1, value FROM json_each(?2)',
          ).bind(tabId, json),
        ]
      : []),
  ];
}

// Settle every sheet of a project at once: delete what was deleted with its element and is now unreferenced, note
// what is unreferenced, and clear what is referenced again. A tab write needs none of it (the sheet_refs triggers
// settle each reference as it changes); a removed tab does, as its link to the project goes first.
export function sheetSettleStatements(
  env: PlanEnv,
  projectId: string,
  now: number,
): D1PreparedStatement[] {
  return [
    env.PLAN_DB.prepare(
      `DELETE FROM sheets WHERE plan_id = ?1 AND delete_when_unreferenced = 1 AND NOT ${REFERENCED}`,
    ).bind(projectId),
    env.PLAN_DB.prepare(
      `UPDATE sheets SET unreferenced_since = ?2
        WHERE plan_id = ?1 AND unreferenced_since IS NULL AND NOT ${REFERENCED}`,
    ).bind(projectId, now),
    env.PLAN_DB.prepare(
      `UPDATE sheets SET unreferenced_since = NULL
        WHERE plan_id = ?1 AND unreferenced_since IS NOT NULL AND ${REFERENCED}`,
    ).bind(projectId),
  ];
}

// A copied tab references what its source did (a copied project's tabs, copied without a parse).
export function sheetRefCopyStatement(
  env: PlanEnv,
  fromTabId: string,
  toTabId: string,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    'INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?2, sheet_id FROM sheet_refs WHERE tab_id = ?1',
  ).bind(fromTabId, toTabId);
}

// A sheet just made notes when nothing references it yet, so one whose element never reaches the api expires too.
export function sheetNoteUnreferencedStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  now: number,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE sheets SET unreferenced_since = ?3 WHERE plan_id = ?1 AND id = ?2 AND NOT ${REFERENCED}`,
  ).bind(projectId, sheetId, now);
}

// The editor's delete with its element: marked, then deleted at once if nothing references it (a row returned).
export function sheetDeleteWhenUnreferencedStatements(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): D1PreparedStatement[] {
  return [
    env.PLAN_DB.prepare(
      'UPDATE sheets SET delete_when_unreferenced = 1 WHERE plan_id = ?1 AND id = ?2',
    ).bind(projectId, sheetId),
    env.PLAN_DB.prepare(
      `DELETE FROM sheets WHERE plan_id = ?1 AND id = ?2 AND NOT ${REFERENCED} RETURNING id`,
    ).bind(projectId, sheetId),
  ];
}

// A restore of a sheet still stored (the editor's undo) keeps it.
export function sheetKeepStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    'UPDATE sheets SET delete_when_unreferenced = NULL WHERE plan_id = ?1 AND id = ?2',
  ).bind(projectId, sheetId);
}
