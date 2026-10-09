// The sheet reference index (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint sheet-store.md
// "Deleting a sheet"). Every tab write replaces the tab's rows: one per Sheet element's `sheetId` and per copy not yet
// made's `copyOf`. As a row goes or comes, the triggers of migration 0079 settle its sheet: unreferenced from then
// (`unreferenced_since`), deleted at once when the editor deleted it with its element, referenced again; an
// unreferenced sheet otherwise waits to expire (sheet-sweep.ts).
import type { Element } from '@livediagram/document';
import type { DbStatement } from '@livediagram/runtime';
import type { Runtime } from '../types';

// A sheet id is unique only in its document (a copied document keeps them), so a reference counts only through a
// tab of the sheet's own document.
export const REFERENCED = `EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
  WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id)`;

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
  env: Runtime,
  tabId: string,
  ids: readonly string[],
): DbStatement[] {
  const json = JSON.stringify(ids);
  return [
    env.db.prepare(
      'DELETE FROM sheet_refs WHERE tab_id = ?1 AND sheet_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, json),
    ...(ids.length
      ? [
          env.db.prepare(
            'INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?1, value FROM json_each(?2)',
          ).bind(tabId, json),
        ]
      : []),
  ];
}

// Settle every sheet of a document at once: delete what was deleted with its element and is now unreferenced, note
// what is unreferenced, and clear what is referenced again. A tab write needs none of it (the triggers of migration
// 0079 settle each reference as it changes); a removed tab does, as its link to the document goes first.
export function sheetSettleStatements(
  env: Runtime,
  documentId: string,
  now: number,
): DbStatement[] {
  return [
    env.db.prepare(
      `DELETE FROM sheets WHERE document_id = ?1 AND delete_when_unreferenced = 1 AND NOT ${REFERENCED}`,
    ).bind(documentId),
    env.db.prepare(
      `UPDATE sheets SET unreferenced_since = ?2
        WHERE document_id = ?1 AND unreferenced_since IS NULL AND NOT ${REFERENCED}`,
    ).bind(documentId, now),
    env.db.prepare(
      `UPDATE sheets SET unreferenced_since = NULL
        WHERE document_id = ?1 AND unreferenced_since IS NOT NULL AND ${REFERENCED}`,
    ).bind(documentId),
  ];
}

// A copied tab references what its source did (a copied document's tabs, copied without a parse).
export function sheetRefCopyStatement(
  env: Runtime,
  fromTabId: string,
  toTabId: string,
): DbStatement {
  return env.db.prepare(
    'INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?2, sheet_id FROM sheet_refs WHERE tab_id = ?1',
  ).bind(fromTabId, toTabId);
}

// A sheet just made notes when nothing references it yet, so one whose element never reaches the api expires too.
export function sheetNoteUnreferencedStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
  now: number,
): DbStatement {
  return env.db.prepare(
    `UPDATE sheets SET unreferenced_since = ?3 WHERE document_id = ?1 AND id = ?2 AND NOT ${REFERENCED}`,
  ).bind(documentId, sheetId, now);
}

// The editor's delete with its element: marked, then deleted at once if nothing references it (a row returned).
export function sheetDeleteWhenUnreferencedStatements(
  env: Runtime,
  documentId: string,
  sheetId: string,
): DbStatement[] {
  return [
    env.db.prepare(
      'UPDATE sheets SET delete_when_unreferenced = 1 WHERE document_id = ?1 AND id = ?2',
    ).bind(documentId, sheetId),
    env.db.prepare(
      `DELETE FROM sheets WHERE document_id = ?1 AND id = ?2 AND NOT ${REFERENCED} RETURNING id`,
    ).bind(documentId, sheetId),
  ];
}

// A restore of a sheet still stored (the editor's undo) keeps it.
export function sheetKeepStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
): DbStatement {
  return env.db.prepare(
    'UPDATE sheets SET delete_when_unreferenced = NULL WHERE document_id = ?1 AND id = ?2',
  ).bind(documentId, sheetId);
}
