// What an image of a Plan tab draws (docs/specs/026-plan/plan-tabs.md "Export"): the tab as it is laid out, never the
// canvas hidden under it. A Board tab is its board alone, a Sheet tab its Sheet and the charts on it, a Dashboard its
// page (dashboard-export.ts). Pure.
import {
  SHEET_COL_HEAD_H,
  SHEET_HEADER_H,
  SHEET_ROW_HEAD_W,
  type Element,
  type SheetAnchor,
  type Tab,
} from '@livepages/document';
import { planTabKindOf } from './plan-export-formats';
import { dashboardExportTab, type DashboardExportInput } from './dashboard-export';

export type PlanImage = {
  // The tab the image exporters draw.
  tab: Tab;
  // Pictures of its placeholder elements, by id (resolvePlanArt).
  art: ReadonlyMap<string, string>;
};

const NO_ART: ReadonlyMap<string, string> = new Map();
// The room kept round a Sheet's last chart, and the most a Sheet tab's image grows to for its cells and charts (a
// side, in px).
const SHEET_EDGE = 24;
const SHEET_IMAGE_MAX = 4000;

// Its layer stays behind with the canvas, so the element is drawn whatever that layer's visibility.
function unlayered(el: Element): Element {
  const { layerId: _layer, ...rest } = el;
  return rest;
}

const isShape = (el: Element, shape: string) => el.type === 'shape' && el.shape === shape;

type SheetEl = Element & {
  x: number;
  y: number;
  width: number;
  height: number;
  planSheet?: { sheetId?: string };
};

type PlanImageInput = Omit<DashboardExportInput, 'tab'> & {
  // Whether a Sheet shows its row and column headers (its layout, from the sheet store); shown when unknown.
  sheetHeads?: (sheetId: string) => boolean;
  // The grid a Sheet's cells fill, in px (@livepages/sheets' sheetContentSize); null or unknown keeps its size.
  sheetContent?: (sheetId: string) => { width: number; height: number } | null;
};

// The image of a Plan tab, or null for any other tab (drawn as its canvas, as ever).
export function planImageOf(tab: Tab, input: PlanImageInput): PlanImage | null {
  const kind = planTabKindOf(tab);
  if (kind === 'dashboard') return dashboardExportTab({ ...input, tab });
  if (kind === 'board') {
    const board = tab.elements.find((el) => isShape(el, 'plan-board'));
    return { tab: plain(tab, board ? [unlayered(board)] : []), art: NO_ART };
  }
  if (kind === 'sheet') {
    const sheet = tab.elements.find((el) => isShape(el, 'plan-sheet')) as SheetEl | undefined;
    if (!sheet) return { tab: plain(tab, []), art: NO_ART };
    const sheetId = sheet.planSheet?.sheetId ?? '';
    // The charts it draws, at their anchors in its grid as the Sheet shows them (sheet.md "Charts"). A chart with no
    // anchor floats at its own place, as on the canvas.
    const heads = input.sheetHeads?.(sheetId) ?? true;
    const left = sheet.x + (heads ? SHEET_ROW_HEAD_W : 0);
    const top = sheet.y + SHEET_HEADER_H + (heads ? SHEET_COL_HEAD_H : 0);
    const own = tab.elements.filter(
      (el) => (el as { chartSource?: { sheetId?: string } }).chartSource?.sheetId === sheetId,
    ) as (Element & { width: number; height: number; sheetAnchor?: SheetAnchor })[];
    const charts = own.map((chart) =>
      chart.sheetAnchor
        ? ({ ...chart, x: left + chart.sheetAnchor.x, y: top + chart.sheetAnchor.y } as Element)
        : (chart as Element),
    );
    // The Sheet grows to take in its filled cells and the charts it holds (as filling the tab, it shows them), within
    // the image limit; a chart past that is out of view.
    let right = sheet.x + sheet.width;
    let bottom = sheet.y + sheet.height;
    const content = input.sheetContent?.(sheetId);
    if (content) {
      right = Math.max(right, left + content.width);
      bottom = Math.max(bottom, top + content.height);
    }
    own.forEach((chart, i) => {
      if (!chart.sheetAnchor) return;
      const placed = charts[i] as Element & { x: number; y: number };
      right = Math.max(right, placed.x + chart.width + SHEET_EDGE);
      bottom = Math.max(bottom, placed.y + chart.height + SHEET_EDGE);
    });
    // The limit caps the growing only: a Sheet already larger keeps its own size.
    const grown = {
      ...sheet,
      width: Math.max(sheet.width, Math.min(right - sheet.x, SHEET_IMAGE_MAX)),
      height: Math.max(sheet.height, Math.min(bottom - sheet.y, SHEET_IMAGE_MAX)),
    };
    const shown = charts.filter((c, i) => {
      if (!own[i]!.sheetAnchor) return true;
      const at = c as Element & { x: number; y: number };
      return at.x < grown.x + grown.width && at.y < grown.y + grown.height;
    });
    return { tab: plain(tab, [grown, ...shown].map(unlayered)), art: NO_ART };
  }
  return null;
}

function plain(tab: Tab, elements: Element[]): Tab {
  const { layers: _layers, ...rest } = tab;
  return { ...rest, elements };
}
