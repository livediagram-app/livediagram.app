// A Dashboard tab as an image (docs/specs/026-plan/plan-tabs.md "Export"): its page laid out at a fixed width, each
// slot a card holding a picture of what it holds, as a tab of elements the image exporters already draw. A board or
// Sheet (its own, or a tab's) becomes that element at the slot's rect; everything else becomes a placeholder element
// whose picture (`art`, by its id) the SVG renderer asks for through `resolvePlanArt`. Pure.
import {
  DASHBOARD_GAP_PX,
  DASHBOARD_SPANS,
  getBuiltInTheme,
  canvasSurface,
  dashboardCardLook,
  isChartShape,
  isDashboardStyledType,
  mixHex,
  planPalette,
  readDashboard,
  tabKindOf,
  type CanvasSurface,
  type DashboardCardLook,
  type DashboardCardStyle,
  type DashboardContent,
  type DashboardLayout,
  type Element,
  type Tab,
  type ThemeDefinition,
} from '@liveplanner/project';
import { box, inPlanFont, r2, type Rect } from './plan-art-kit';
import { cardArt, slotMessageArt, type SheetMetricArt } from './dashboard-card-art';

// The page's width in the image, and the height of a row that fills the page (a Visualisation tab's chart).
const DASHBOARD_EXPORT_WIDTH = 1440;
const DASHBOARD_EXPORT_FILL_H = 720;
// The image's own margin (EXPORT_PADDING) frames the page, so the rows span the width less it on each side.
const EXPORT_MARGIN = 32;
const ROW_W = DASHBOARD_EXPORT_WIDTH - EXPORT_MARGIN * 2;

export type DashboardExportInput = {
  // The Dashboard, as seen (its backdrop resolved for the viewer's appearance).
  tab: Tab;
  // The project's tabs, for the slots that show one.
  tabs: readonly Tab[];
  now: Date;
  // Each figure from a Sheet, by slot id, read now.
  metrics?: ReadonlyMap<string, SheetMetricArt>;
  // A tab's theme by id on a surface: the editor's own (in the viewer's appearance); the built-in ones when absent.
  themeOf?: (id: string | undefined, surface: CanvasSurface) => ThemeDefinition;
};

type DashboardExport = {
  // The page as a tab of elements, for the image exporters.
  tab: Tab;
  // The pictures of the placeholder elements, by element id.
  art: ReadonlyMap<string, string>;
};

// The slots' rects, row by row: each its twelfths of the row less its share of the gaps; a fill row 720 px tall.
function dashboardSlotRects(
  layout: DashboardLayout,
): { slotId: string; content?: DashboardContent; rect: Rect }[] {
  const out: { slotId: string; content?: DashboardContent; rect: Rect }[] = [];
  let y = 0;
  for (const row of layout.rows) {
    const h = row.fill ? DASHBOARD_EXPORT_FILL_H : row.height;
    let x = 0;
    for (const slot of row.slots) {
      const w = (slot.span * (ROW_W + DASHBOARD_GAP_PX)) / DASHBOARD_SPANS - DASHBOARD_GAP_PX;
      out.push({
        slotId: slot.id,
        ...(slot.content ? { content: slot.content } : {}),
        rect: { x: r2(x), y, width: r2(w), height: h },
      });
      x += w + DASHBOARD_GAP_PX;
    }
    y += h + DASHBOARD_GAP_PX;
  }
  return out;
}

// The slot's card (DashboardSlotView): white at 72% over the page (slate 900 at 60% in dark), 16 px corners, a
// hairline edge. A styled Utility's fill and border over it (plan-tabs.md "Card style"); the shadow is the screen's.
function slotCard(
  r: Rect,
  surface: CanvasSurface,
  paper: string,
  look: DashboardCardLook = {},
): string {
  const dark = surface === 'dark';
  const fill = look.fill ?? (dark ? mixHex('#0f172a', paper, 0.6) : mixHex('#ffffff', paper, 0.72));
  const edge =
    look.stroke ?? (dark ? mixHex('#ffffff', fill, 0.08) : mixHex('#0f172a', fill, 0.07));
  if (look.borderWidth === 0) return box(r, { fill, rx: 16 });
  return box(r, { fill, stroke: edge, rx: 16, strokeWidth: look.borderWidth ?? 1 });
}

const placeholder = (id: string, r: Rect): Element => ({
  id,
  type: 'shape',
  shape: 'plan-view',
  x: r.x,
  y: r.y,
  width: r.width,
  height: r.height,
});

export function dashboardExportTab(input: DashboardExportInput): DashboardExport {
  const { tab, tabs } = input;
  const layout = readDashboard(tab.dashboard) ?? { rows: [] };
  const paper = tab.backgroundColor ?? '#ffffff';
  const surface = canvasSurface(paper);
  const p = planPalette(surface);
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const elements: Element[] = [];
  const art = new Map<string, string>();
  // A card behind the slot, holding `inner` (its picture, if any).
  const card = (slotId: string, r: Rect, inner = '', look?: DashboardCardLook) => {
    const id = `export-slot-${slotId}`;
    elements.push(placeholder(id, r));
    art.set(id, inPlanFont(slotCard(r, surface, paper, look) + inner));
  };
  // An element drawn in the slot at its rect, under an id of the slot's own (`export-el-` for the tab's own element,
  // `export-tab-` for a tab's), so two slots showing the same element never share an id in the image (the rasteriser
  // keys its pictures by id). Its layer is left behind with the canvas, so it is drawn whatever that layer's
  // visibility.
  const place = (el: Element, r: Rect, id: string) => {
    const { layerId: _layer, ...rest } = el;
    elements.push({ ...rest, id, x: r.x, y: r.y, width: r.width, height: r.height } as Element);
  };

  for (const { slotId, content, rect } of dashboardSlotRects(layout)) {
    if (!content) {
      card(slotId, rect, slotMessageArt(rect, p, 'Empty Slot', true));
      continue;
    }
    if (content.type === 'element') {
      const el = byId.get(content.elementId);
      const shape = el?.type === 'shape' ? el : null;
      if (!shape) {
        card(slotId, rect, slotMessageArt(rect, p, 'This item was removed.'));
      } else if (
        shape.shape === 'plan-board' ||
        shape.shape === 'plan-sheet' ||
        shape.shape === 'plan-view'
      ) {
        card(slotId, rect);
        place(shape, rect, `export-el-${slotId}`);
      } else if (isChartShape(shape.shape)) {
        // A chart from a Sheet draws on the slot's card, inset as the slot insets it.
        card(slotId, rect);
        place(
          shape,
          { x: rect.x + 12, y: rect.y + 12, width: rect.width - 24, height: rect.height - 24 },
          `export-el-${slotId}`,
        );
      } else {
        card(slotId, rect, slotMessageArt(rect, p, 'This item was removed.'));
      }
      continue;
    }
    if (content.type === 'tab') {
      tabSlot(slotId, rect, content.tabId, content.of);
      continue;
    }
    // A styled Utility's look, for the tab's theme on the image's paper; its inks write its text.
    const look = isDashboardStyledType(content.type)
      ? dashboardCardLook(
          (content as { style?: DashboardCardStyle }).style,
          (input.themeOf ?? getBuiltInTheme)(tab.theme, surface),
        )
      : {};
    const written = cardArt(content, {
      rect,
      p: look.ink ? { ...p, text: look.ink, muted: look.inkSoft ?? look.ink } : p,
      now: input.now,
      tabName: (id) => tabs.find((t) => t.id === id)?.name,
      metric: input.metrics?.get(slotId),
    });
    if (content.type === 'title') {
      // A Title is drawn bare on the page, no card.
      const id = `export-slot-${slotId}`;
      elements.push(placeholder(id, rect));
      art.set(id, inPlanFont(written));
    } else card(slotId, rect, written, look);
  }

  function tabSlot(slotId: string, rect: Rect, tabId: string, of: string | undefined) {
    const shown = tabs.find((t) => t.id === tabId);
    if (!shown) {
      const what = of === 'sheet' ? 'Sheet' : 'Board';
      card(slotId, rect, slotMessageArt(rect, p, `This ${what} was deleted.`));
      return;
    }
    // A tab whose content has not arrived has no kind yet: it waits as the Board or Sheet the slot was given.
    const waiting = !shown.kind && shown.elements.length === 0;
    const kind = waiting ? (of === 'sheet' ? 'sheet' : 'board') : tabKindOf(shown);
    if (kind === 'board' || kind === 'sheet') {
      const own = shown.elements.find(
        (el) =>
          el.type === 'shape' && el.shape === (kind === 'sheet' ? 'plan-sheet' : 'plan-board'),
      );
      if (!own) {
        // Not arrived yet, or nothing on it: the slot's own words for either.
        card(slotId, rect, slotMessageArt(rect, p, `Loading ${shown.name}…`));
        return;
      }
      card(slotId, rect);
      place(own, rect, `export-tab-${slotId}`);
      return;
    }
    // Only a Board or Sheet tab goes in a slot (a forged layout may name another).
    card(slotId, rect, slotMessageArt(rect, p, 'This tab is not a Board or Sheet.'));
  }

  const { dashboard: _layout, layers: _layers, ...rest } = tab;
  return { tab: { ...rest, elements }, art };
}
