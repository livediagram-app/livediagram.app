// What a Plan tab exports to (docs/specs/026-plan/plan-tabs.md "Export"): each kind only the formats that can carry
// it. Pure.
import { tabKindOf, type Tab } from '@liveplanner/document';

// The Export dialog's format keys ('file' is the liveplanner .json).
export type ExportFormatKey =
  | 'markdown'
  | 'csv'
  | 'mermaid'
  | 'excalidraw'
  | 'pdf'
  | 'png'
  | 'svg'
  | 'gif'
  | 'file'
  | 'logo-kit';

// A Board tab: its picture, its board's outline (each column and its cards) and its cards as CSV. A Sheet tab: its
// picture and its cells as CSV. A Dashboard tab: its page's picture, and the JSON its Import reads back.
const PLAN_TAB_FORMATS = {
  board: ['png', 'svg', 'pdf', 'markdown', 'csv'],
  sheet: ['png', 'svg', 'pdf', 'csv'],
  dashboard: ['png', 'svg', 'pdf', 'file'],
} as const satisfies Record<string, readonly ExportFormatKey[]>;

export type PlanTabKind = keyof typeof PLAN_TAB_FORMATS;

// The Plan tab kind an export draws as laid out, or null for any other tab.
export function planTabKindOf(tab: Pick<Tab, 'kind'>): PlanTabKind | null {
  const kind = tabKindOf(tab);
  return kind === 'board' || kind === 'sheet' || kind === 'dashboard' ? kind : null;
}

// A Form tab: the form is no element, so its canvas is empty and every picture or outline of it was blank; only the
// JSON carries it (and imports back as the form).
const FORM_TAB_FORMATS = ['file'] as const satisfies readonly ExportFormatKey[];

// The formats offered for the tab, in the dialog's order; undefined offers every one (any other tab).
export function exportFormatsFor(tab: Pick<Tab, 'kind'>): readonly ExportFormatKey[] | undefined {
  if (tabKindOf(tab) === 'form') return FORM_TAB_FORMATS;
  const kind = planTabKindOf(tab);
  return kind ? PLAN_TAB_FORMATS[kind] : undefined;
}
