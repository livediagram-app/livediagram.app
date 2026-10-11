// What a Plan tab exports to (docs/specs/026-plan/plan-tabs.md "Export"): each kind only the formats that can carry
// it. Pure.
import { tabKindOf, type Tab } from '@livediagram/document';

// The Export dialog's format keys ('file' is the livediagram .json).
export type ExportFormatKey =
  'markdown' | 'mermaid' | 'excalidraw' | 'pdf' | 'png' | 'svg' | 'file' | 'logo-kit';

// A Board tab: its picture, and its board's outline (each column and its cards). A Sheet tab: its picture (its CSV
// is the tab menu's Download CSV). A Dashboard tab: its page's picture, and the JSON its Import reads back.
const PLAN_TAB_FORMATS = {
  board: ['png', 'svg', 'pdf', 'markdown'],
  sheet: ['png', 'svg', 'pdf'],
  dashboard: ['png', 'svg', 'pdf', 'file'],
} as const satisfies Record<string, readonly ExportFormatKey[]>;

export type PlanTabKind = keyof typeof PLAN_TAB_FORMATS;

// The Plan tab kind an export draws as laid out, or null for any other tab.
export function planTabKindOf(tab: Pick<Tab, 'kind'>): PlanTabKind | null {
  const kind = tabKindOf(tab);
  return kind === 'board' || kind === 'sheet' || kind === 'dashboard' ? kind : null;
}

// The formats offered for the tab, in the dialog's order; undefined offers every one (any other tab).
export function exportFormatsFor(tab: Pick<Tab, 'kind'>): readonly ExportFormatKey[] | undefined {
  const kind = planTabKindOf(tab);
  return kind ? PLAN_TAB_FORMATS[kind] : undefined;
}
