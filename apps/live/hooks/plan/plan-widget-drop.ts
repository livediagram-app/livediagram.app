// A widget from the palette lands only in a board's header (docs/specs/025-plan/board-widgets.md
// "Placing and arranging widgets"): dragged over a header, that board's widget zone shows where it
// would go; dropped there, it is placed; dropped anywhere else, nothing happens and the reason is said.
// The board under the pointer comes from the same registry and DOM read as a palette card's.
import { isBoardWidgetKind, type BoardWidgetKind } from '@livediagram/items';
import { otherPlanBoardAt, planBoardIds, planBoardTarget } from './plan-board-targets';

export const PLAN_WIDGET_MISSED = 'Drop a widget into a board’s header';

// Where in a widget zone a point falls: the place before the first widget whose middle is right of
// it, counting the widgets as they are (the dragged one, `except`, is skipped as a landmark).
export function widgetSlotAt(zone: HTMLElement, clientX: number, except?: string): number {
  const els = [...zone.querySelectorAll<HTMLElement>('[data-widget]')];
  let slot = 0;
  els.forEach((el, i) => {
    if (el.dataset.widget === except) return;
    const r = el.getBoundingClientRect();
    if (r.left + r.width / 2 < clientX) slot = i + 1;
  });
  return slot;
}

// The board whose header holds a screen point, with its widget zone.
function headerAt(clientX: number, clientY: number) {
  const hit = otherPlanBoardAt(clientX, clientY, '');
  const target = hit ? planBoardTarget(hit.id) : undefined;
  const header = hit?.el.querySelector<HTMLElement>('[data-board-header]');
  const zone = hit?.el.querySelector<HTMLElement>('[data-widget-zone]');
  if (!hit || !target || !header || !zone) return null;
  const r = header.getBoundingClientRect();
  if (clientY < r.top || clientY > r.bottom) return null;
  return { id: hit.id, target, zone };
}

let hovered: string | null = null;
// The open editor's toast, to say a miss, and its selection, for a tapped tile. Set while an editor is
// open.
type WidgetEditor = { notice: (message: string) => void; selectedId: () => string | null };
const NO_EDITOR: WidgetEditor = { notice: () => {}, selectedId: () => null };
let editor: WidgetEditor = NO_EDITOR;

export function setPlanWidgetEditor(next: WidgetEditor): () => void {
  editor = next;
  return () => {
    if (editor === next) editor = NO_EDITOR;
  };
}

export const PLAN_WIDGET_NO_BOARD = 'Select a board to add the widget to';

// A tapped widget tile: added at the end of the selected board's header, or the only board's.
export function addPlanWidgetToBoard(kind: BoardWidgetKind): void {
  const ids = planBoardIds();
  const selected = editor.selectedId();
  const id = selected && ids.includes(selected) ? selected : ids.length === 1 ? ids[0] : undefined;
  const target = id ? planBoardTarget(id) : undefined;
  if (!target || !target.canEditWidgets()) {
    editor.notice(PLAN_WIDGET_NO_BOARD);
    return;
  }
  target.placeWidget(kind, Number.MAX_SAFE_INTEGER);
}

// The canvas's drop of a widget tile: placed, or the miss said.
export function dropPlanWidgetFromPalette(kind: string, clientX: number, clientY: number): void {
  if (!isBoardWidgetKind(kind)) return;
  const result = dropPlanWidgetAt(kind, clientX, clientY);
  if (result.message) editor.notice(result.message);
}

function clearHover(): void {
  if (hovered) planBoardTarget(hovered)?.widgetHover(null);
  hovered = null;
}

let listening = false;

// A widget drag over the canvas: the board header under the point shows the place. True while one does.
export function planWidgetDragOver(clientX: number, clientY: number): boolean {
  // A drag let go anywhere (or cancelled) takes the place marker with it.
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('dragend', clearHover);
    listening = true;
  }
  const at = headerAt(clientX, clientY);
  if (hovered && hovered !== at?.id) clearHover();
  if (!at || !at.target.canEditWidgets()) return false;
  hovered = at.id;
  at.target.widgetHover(widgetSlotAt(at.zone, clientX));
  return true;
}

export function dropPlanWidgetAt(
  kind: BoardWidgetKind,
  clientX: number,
  clientY: number,
): { placed: boolean; message?: string } {
  clearHover();
  const at = headerAt(clientX, clientY);
  if (!at || !at.target.canEditWidgets()) return { placed: false, message: PLAN_WIDGET_MISSED };
  at.target.placeWidget(kind, widgetSlotAt(at.zone, clientX));
  return { placed: true };
}

export const endPlanWidgetDrag = clearHover;
