// The daily sweep of sheets no element frames (docs/specs/029-sheets/sheet-store.md "Sheets no element frames"):
// deleting a Sheet element keeps its sheet, so undo and a restored tab bring it back; one unframed for
// SHEET_UNFRAMED_DAYS is deleted for good. Bounded per run and stateless: it checks a random handful of tabs each
// day, so every tab is seen within days, well inside the 30.
import type { Env } from './types';

export const SHEET_UNFRAMED_DAYS = 30;
export const SHEET_SWEEP_TABS_MAX = 500;
const DAY_MS = 86_400_000;

// The sheet ids a tab's stored elements frame.
export function framedSheetIds(data: string | null): Set<string> {
  const out = new Set<string>();
  if (!data || !data.includes('planSheet')) return out;
  try {
    const parsed = JSON.parse(data) as {
      elements?: { shape?: unknown; planSheet?: { sheetId?: unknown } }[];
    };
    for (const el of parsed.elements ?? [])
      if (el?.shape === 'plan-sheet' && typeof el.planSheet?.sheetId === 'string')
        out.add(el.planSheet.sheetId);
  } catch {
    // An unreadable tab frames nothing it can prove; its sheets are kept until it reads again.
    return new Set(['*']);
  }
  return out;
}

export async function runSheetSweep(
  env: Env,
  now = Date.now(),
): Promise<{ marked: number; cleared: number; deleted: number }> {
  const pairs = await env.DB.prepare(
    `SELECT document_id, tab_id FROM (SELECT DISTINCT document_id, tab_id FROM sheets) ORDER BY RANDOM() LIMIT ?`,
  )
    .bind(SHEET_SWEEP_TABS_MAX)
    .all<{ document_id: string; tab_id: string }>();
  let marked = 0;
  let cleared = 0;
  let deleted = 0;
  for (const { document_id: doc, tab_id: tab } of pairs.results ?? []) {
    // A tab no longer in the document frames nothing.
    const row = await env.DB.prepare(
      `SELECT t.data FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id WHERE dt.document_id = ? AND t.id = ?`,
    )
      .bind(doc, tab)
      .first<{ data: string }>();
    const framed = framedSheetIds(row?.data ?? null);
    if (framed.has('*')) continue;
    const sheets = await env.DB.prepare(
      `SELECT id, unframed_since FROM sheets WHERE document_id = ? AND tab_id = ?`,
    )
      .bind(doc, tab)
      .all<{ id: string; unframed_since: number | null }>();
    const statements: D1PreparedStatement[] = [];
    for (const s of sheets.results ?? []) {
      if (framed.has(s.id)) {
        if (s.unframed_since !== null) {
          statements.push(
            env.DB.prepare(
              `UPDATE sheets SET unframed_since = NULL WHERE document_id = ? AND id = ?`,
            ).bind(doc, s.id),
          );
          cleared++;
        }
      } else if (s.unframed_since === null) {
        statements.push(
          env.DB.prepare(
            `UPDATE sheets SET unframed_since = ? WHERE document_id = ? AND id = ?`,
          ).bind(now, doc, s.id),
        );
        marked++;
      } else if (now - s.unframed_since >= SHEET_UNFRAMED_DAYS * DAY_MS) {
        statements.push(
          env.DB.prepare(`DELETE FROM sheets WHERE document_id = ? AND id = ?`).bind(doc, s.id),
        );
        deleted++;
      }
    }
    if (statements.length) await env.DB.batch(statements);
  }
  console.info('[sheets] sheets.sweep', {
    tabs: pairs.results?.length ?? 0,
    marked,
    cleared,
    deleted,
  });
  return { marked, cleared, deleted };
}
