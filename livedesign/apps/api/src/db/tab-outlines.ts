// A document's tabs as the plan read names them (docs/specs/026-plan/plan-agents.md "Reading the plan": tabs): each
// tab's id, name, kind and theme, and a Sheet tab's sheet ids in canvas order, read from the stored JSON in SQL so no tab
// body leaves the database. A tab-scoped grant reads its own tab only.
import type { PlanTabOutline } from '@livedesign/api-schema';
import type { Env } from '../types';

type OutlineRow = { id: string; name: string; kind: string | null; theme: string | null };
type SheetRow = { tab_id: string; sheet_id: string };

export async function tabOutlines(
  env: Env,
  documentId: string,
  onlyTab: string | null,
): Promise<PlanTabOutline[]> {
  const scope = onlyTab === null ? '' : ' AND t.id = ?';
  const binds = onlyTab === null ? [documentId] : [documentId, onlyTab];
  const [tabs, sheets] = await env.DB.batch([
    env.DB.prepare(
      `SELECT t.id, t.name, json_extract(t.data, '$.kind') AS kind, json_extract(t.data, '$.theme') AS theme
         FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
        WHERE dt.document_id = ?${scope}
        ORDER BY dt.order_index, t.id`,
    ).bind(...binds),
    env.DB.prepare(
      `SELECT t.id AS tab_id, json_extract(e.value, '$.planSheet.sheetId') AS sheet_id
         FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id, json_each(t.data, '$.elements') e
        WHERE dt.document_id = ?${scope}
          AND json_extract(t.data, '$.kind') = 'sheet'
          AND json_extract(e.value, '$.shape') = 'plan-sheet'
          AND json_extract(e.value, '$.planSheet.sheetId') IS NOT NULL
        ORDER BY dt.order_index, e.key`,
    ).bind(...binds),
  ]);
  const byTab = new Map<string, string[]>();
  for (const row of (sheets?.results ?? []) as SheetRow[]) {
    const list = byTab.get(row.tab_id) ?? [];
    list.push(row.sheet_id);
    byTab.set(row.tab_id, list);
  }
  return ((tabs?.results ?? []) as OutlineRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind ?? 'diagram',
    ...(t.theme ? { theme: t.theme } : {}),
    ...(byTab.has(t.id) ? { sheetIds: byTab.get(t.id)! } : {}),
  }));
}
