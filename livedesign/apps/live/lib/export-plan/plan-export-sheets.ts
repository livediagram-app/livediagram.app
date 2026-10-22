// The Sheets an image draws (docs/specs/026-plan/plan-tabs.md "Export", docs/specs/029-sheets/sheet.md "Exports and
// images"): each Sheet element's window of cells and each Dashboard figure from a Sheet, read from the editor's sheet
// store as the Sheets show them now. Loaded only when an image has a Sheet to draw, so the sheets engine stays out of
// the Export dialog until then.
import {
  readDashboard,
  type DashboardLayout,
  type Element,
  type SheetRenderModel,
  type Tab,
} from '@livedesign/document';
import { renderFrameWindow, sheetContentSize, sheetFramesOf } from '@livedesign/sheets';
import type { SheetStore } from '@/components/sheets/sheet-store-client';
import { sheetMetricShown } from '@/components/plan/dashboard/sheet-metric-shown';
import type { SheetMetricArt } from '@livedesign/plan-art';

// The cells each Sheet element shows, by sheet id: the window its frame has room for. A sheet the store has not
// loaded is left out (it draws its frame and headers).
export function sheetModelsFor(
  elements: readonly Element[],
  store: Pick<SheetStore, 'sheet' | 'workbook'>,
): Map<string, SheetRenderModel> {
  const out = new Map<string, SheetRenderModel>();
  for (const frame of sheetFramesOf(elements)) {
    if (out.has(frame.sheetId)) continue;
    const sheet = store.sheet(frame.sheetId);
    if (!sheet) continue;
    const model = renderFrameWindow(store.workbook(sheet.tabId), frame);
    if (model) out.set(frame.sheetId, model);
  }
  return out;
}

// The grid each framed Sheet's cells fill, by sheet id (sheetContentSize): a Sheet tab's image grows its Sheet to it,
// so every filled cell is in the picture, as the tab shows it. A sheet the store has not loaded, or an empty one, is
// left out (it keeps its frame's size).
export function sheetContentsFor(
  elements: readonly Element[],
  store: Pick<SheetStore, 'sheet'>,
): Map<string, { width: number; height: number }> {
  const out = new Map<string, { width: number; height: number }>();
  for (const frame of sheetFramesOf(elements)) {
    const sheet = store.sheet(frame.sheetId);
    const size = sheet ? sheetContentSize(sheet) : null;
    if (size) out.set(frame.sheetId, size);
  }
  return out;
}

// Each figure from a Sheet on the dashboard, by slot id: what it shows now, still loading, or gone.
export function sheetMetricsFor(
  dashboard: DashboardLayout | undefined,
  tabs: readonly Tab[],
  store: Pick<SheetStore, 'sheet' | 'workbook'>,
  locale: string,
): Map<string, SheetMetricArt> {
  const out = new Map<string, SheetMetricArt>();
  const layout = readDashboard(dashboard);
  if (!layout) return out;
  for (const row of layout.rows)
    for (const slot of row.slots) {
      const c = slot.content;
      if (c?.type !== 'sheet-metric') continue;
      if (!c.sheetId) {
        out.set(slot.id, 'unset');
        continue;
      }
      const sheet = store.sheet(c.sheetId);
      if (sheet) {
        out.set(slot.id, sheetMetricShown(c, { sheet, wb: store.workbook(sheet.tabId), locale }));
        continue;
      }
      const placed = tabs.some((t) =>
        t.elements.some(
          (el) => (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId === c.sheetId,
        ),
      );
      out.set(slot.id, placed ? 'loading' : 'gone');
    }
  return out;
}

// The sheets the image reads: those its elements frame, and those its figures read, by the tab that holds each.
export function sheetTabsToLoad(
  image: Tab,
  dashboard: DashboardLayout | undefined,
  tabs: readonly Tab[],
): string[] {
  const wanted = new Set(sheetFramesOf(image.elements as never).map((f) => f.sheetId));
  for (const row of readDashboard(dashboard)?.rows ?? [])
    for (const s of row.slots)
      if (s.content?.type === 'sheet-metric' && s.content.sheetId) wanted.add(s.content.sheetId);
  const out = new Set<string>();
  for (const t of tabs)
    for (const el of t.elements) {
      const id = (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId;
      if (id && wanted.has(id)) out.add(t.id);
    }
  return [...out];
}
