// A Board or Sheet tab's CSV for the Export dialog (docs/specs/026-plan/plan-tabs.md "Export"): the board's cards or
// the Sheet's cells as the open tab draws them, read from what each publishes as it renders (board-csv-registry,
// sheet-settings-registry). Loaded with the Export dialog only, so the CSV writer never rides the editor's first load.
import type { Tab } from '@livepages/document';
import { boardCsvEntryOf } from '@/components/plan/board-csv-registry';
import { sheetSettingsEntryOf } from '@/components/sheets/sheet-settings-registry';
import { sheetCsvText } from '@/components/sheets/sheet-csv';

export function tabCsvText(tab: Pick<Tab, 'kind' | 'elements'>): string {
  const shape = tab.kind === 'board' ? 'plan-board' : tab.kind === 'sheet' ? 'plan-sheet' : null;
  const el = shape ? tab.elements.find((e) => e.type === 'shape' && e.shape === shape) : undefined;
  if (!el) return '';
  if (shape === 'plan-board') return boardCsvEntryOf(el.id)?.csvText() ?? '';
  const entry = sheetSettingsEntryOf(el.id);
  return entry ? sheetCsvText(entry.controller.workbook, entry.controller.sheet) : '';
}
