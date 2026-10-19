'use client';

// The charts that sit in a Sheet (docs/specs/029-sheets/sheet.md "Charts"): drawn over its cells at their anchors,
// clipped to the grid, scrolling and zooming with the cells. Someone who may shape the Sheet (an Editor) selects one
// by clicking it, drags it to move it, drags its corner to resize it and removes it with Delete, Backspace or Delete
// Chart; each is one undo step (bridge.commitElements). A right-click on one, or its Chart Options button, opens the
// element menu the canvas opens for that chart (Style, Legend, Palette, the chart type, Unlink From Sheet). Anyone else
// sees them, and the pointer passes through to the cells.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Tooltip } from '@livediagram/ui';
import {
  CHART_TYPE_LABELS,
  chartTypeOf,
  chartsInSheet,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { DataChartView } from '@/components/canvas/DataChartView';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { useSheetCharts } from './sheet-charts-context';
import { useSheetController } from './sheet-controller';
import { SheetLinkedChart } from './SheetLinkedChart';
import { movedAnchor, resizedChart, takePlacedChart } from './sheet-charts';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { openElementMenu } from '@/hooks/canvas/element-menu-opener';
import { DeleteIcon, MoreIcon } from './sheet-icons';

// A press that moves less than this (sheet px) is a click, not a drag.
const DRAG_SLOP_PX = 3;
const HANDLE_PX = 10;
// The element menu opens this far below its anchor (element-menu-opener); a right-click's opens at the pointer.
const MENU_GAP_PX = 4;

// Shift and an arrow move or resize a chart this far (sheet px); an arrow alone, 1 px (the canvas's nudge steps).
const KEY_STEP_LARGE_PX = 10;
const CHART_KEYS =
  'ArrowLeft ArrowRight ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Delete Escape';
const CHART_KEYS_HELP =
  'Arrow keys move it, Alt and the arrow keys resize it, Delete removes it, Escape lets it go.';

type Drag = { id: string; kind: 'move' | 'resize'; dx: number; dy: number };

export function SheetChartsLayer({ fontFamily }: { fontFamily?: string | undefined }) {
  const ctx = useSheetCharts();
  const c = useSheetController();
  const bridge = useSheetsBridgeContext();
  const elements = ctx?.elements;
  const sheetId = c.sheet.id;
  const charts = useMemo(
    () => (elements ? (chartsInSheet(elements as Element[], sheetId) as ShapeElement[]) : []),
    [elements, sheetId],
  );
  // An Editor's, on the open tab, with the Sheet taking input (sheet.md "Charts"; share-roles.md).
  const editable = !!ctx?.editable && !!bridge && c.interactive && c.canShape === true;
  const drawn = ctx?.renderChart;
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  // A chart this person just inserted is selected as it arrives, ready to move: focused, which selects it.
  useEffect(() => {
    const placed = charts.find((el) => takePlacedChart(el.id));
    if (!placed || !editable) return;
    layerRef.current
      ?.querySelector<HTMLElement>(`[data-sheet-chart="${placed.id}"]`)
      ?.focus({ preventScroll: true });
  }, [charts, editable]);
  if (charts.length === 0) return null;

  const commit = (id: string, patch: (el: ShapeElement) => Partial<ShapeElement> | null) =>
    bridge?.commitElements((els) =>
      els.map((el) => {
        if (el.id !== id || el.type !== 'shape') return el;
        const p = patch(el);
        return p ? { ...el, ...p } : el;
      }),
    );
  const remove = (id: string) => {
    bridge?.commitElements((els) => els.filter((el) => el.id !== id));
    setSelected(null);
    c.focusGrid();
  };
  // Screen px per sheet px: the canvas zoom times the Sheet's own (both are transforms above this layer).
  const scaleOf = () => {
    const el = layerRef.current;
    return el && el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1;
  };
  const begin = (e: ReactPointerEvent, el: ShapeElement, kind: Drag['kind']) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(el.id);
    e.currentTarget.closest<HTMLElement>('[data-sheet-chart]')?.focus({
      preventScroll: true,
    });
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const scale = scaleOf();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let last: Drag | null = null;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / scale;
      const dy = (ev.clientY - y0) / scale;
      if (!last && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
      last = { id: el.id, kind, dx, dy };
      setDrag(last);
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (!last) return;
      const { dx, dy } = last;
      commit(el.id, (cur) =>
        kind === 'move'
          ? cur.sheetAnchor
            ? { sheetAnchor: movedAnchor(cur.sheetAnchor, dx, dy) }
            : null
          : resizedChart(cur, dx, dy),
      );
    };
    const cancel = () => {
      last = null;
      end();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', cancel);
  };

  return (
    <div
      ref={layerRef}
      data-sheet-charts
      // The layer lives inside role="grid", which may own only rows: the charts sit in one row and cell of their own.
      role="row"
      aria-label="Charts"
      className="pointer-events-none absolute inset-0 z-[6]"
      // A press on a chart is the chart's, never the cells' or the canvas's.
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-sheet-chart]')) e.stopPropagation();
      }}
    >
      <div role="gridcell" className="absolute inset-0">
        {charts.map((el) => {
          const at = el.sheetAnchor!;
          const d = drag?.id === el.id ? drag : null;
          const pos = d?.kind === 'move' ? movedAnchor(at, d.dx, d.dy) : at;
          const size = d?.kind === 'resize' ? resizedChart(el, d.dx, d.dy) : el;
          // The element itself unless it is being resized: a new object every render (a scroll frame, a canvas drag)
          // would have its chart read its range again each time.
          const shown =
            d?.kind === 'resize' ? { ...el, width: size.width, height: size.height } : el;
          const isSelected = editable && selected === el.id;
          return (
            <div
              key={el.id}
              data-sheet-chart={el.id}
              role={editable ? 'group' : 'img'}
              aria-label={`${chartName(el)} chart`}
              tabIndex={editable ? 0 : -1}
              // Escape lets a selected chart go before it restores a maximised Sheet.
              data-keeps-escape={isSelected ? '' : undefined}
              className={`absolute outline-none ${drawn ? '' : 'rounded-lg border'} ${editable ? 'pointer-events-auto cursor-move' : ''}`}
              style={{
                left: pos.x - c.scroll.left,
                top: pos.y - c.scroll.top,
                width: size.width,
                height: size.height,
                ...(drawn ? ringStyle(isSelected, c.palette) : cardStyle(isSelected, c.palette)),
              }}
              // Taken on the way down, before the chart view under it (whose canvas gestures would drag or select it on
              // the canvas), except a press on the frame's own controls or on the chart's indicators.
              onPointerDownCapture={(e) => {
                if (!framePress(e)) return;
                e.stopPropagation();
                begin(e, el, 'move');
              }}
              onPointerUpCapture={(e) => viewPress(e) && e.stopPropagation()}
              onClickCapture={(e) => viewPress(e) && e.stopPropagation()}
              onDoubleClickCapture={(e) => framePress(e) && e.stopPropagation()}
              onContextMenuCapture={(e) => {
                if (!framePress(e)) return;
                e.stopPropagation();
                if (!editable) return;
                // The canvas's element menu for this chart, at the pointer (as a right-click on the canvas opens it).
                e.preventDefault();
                setSelected(el.id);
                openElementMenu(el.id, new DOMRect(e.clientX, e.clientY - MENU_GAP_PX, 0, 0));
              }}
              aria-keyshortcuts={editable ? CHART_KEYS : undefined}
              aria-description={editable ? CHART_KEYS_HELP : undefined}
              onKeyDown={(e) => {
                if (!editable || e.target !== e.currentTarget) return;
                // A selected chart's keys are its own: none reaches the grid or the canvas's shortcuts (a typed r
                // would add a rectangle), except undo and redo.
                if (isUndoChord(e)) return;
                e.stopPropagation();
                const step = arrowStep(e.key, e.shiftKey ? KEY_STEP_LARGE_PX : 1);
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  remove(el.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSelected(null);
                  c.focusGrid();
                } else if (step) {
                  // Arrows move it, Alt and the arrows resize it (the corner handle's keyboard way): one undo step each.
                  e.preventDefault();
                  commit(el.id, (cur) =>
                    e.altKey
                      ? resizedChart(cur, step.dx, step.dy)
                      : cur.sheetAnchor
                        ? { sheetAnchor: movedAnchor(cur.sheetAnchor, step.dx, step.dy) }
                        : null,
                  );
                }
              }}
              onBlur={(e) => {
                const next = e.relatedTarget;
                if (next instanceof Node && e.currentTarget.contains(next)) return;
                setSelected((s) => (s === el.id ? null : s));
              }}
              onFocus={() => editable && setSelected(el.id)}
            >
              {/* Drawn by the canvas's own element view when there is a canvas (sheet-chart-renderer): its style,
                shadow, animations and indicators as on the canvas. It takes no pointer; this frame does. */}
              <div
                className={`pointer-events-none absolute inset-0 ${drawn ? '' : 'overflow-hidden rounded-lg'}`}
              >
                <SheetLinkedChart element={shown}>
                  {(live) =>
                    drawn ? (
                      drawn(live, !!ctx?.editable)
                    ) : (
                      <DataChartView
                        element={live}
                        fontFamily={fontFamily}
                        textColor={c.palette.text}
                        palette={ctx?.chartPalette}
                      />
                    )
                  }
                </SheetLinkedChart>
              </div>
              {isSelected ? (
                <>
                  {/* Top left: the chart's indicators sit along its top right, where these would cover them. */}
                  <div
                    className="absolute left-1 top-1 flex gap-1"
                    data-sheet-chart-control
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ChartButton
                      label="Chart Options"
                      palette={c.palette}
                      menu
                      onClick={(e) =>
                        openElementMenu(el.id, e.currentTarget.getBoundingClientRect())
                      }
                    >
                      <MoreIcon />
                    </ChartButton>
                    <ChartButton
                      label="Delete Chart"
                      palette={c.palette}
                      onClick={() => remove(el.id)}
                    >
                      <DeleteIcon />
                    </ChartButton>
                  </div>
                  <div
                    aria-hidden
                    data-sheet-chart-resize
                    data-sheet-chart-control
                    className="absolute cursor-nwse-resize rounded-sm border"
                    style={{
                      right: -HANDLE_PX / 2,
                      bottom: -HANDLE_PX / 2,
                      width: HANDLE_PX,
                      height: HANDLE_PX,
                      backgroundColor: c.palette.surface,
                      borderColor: c.palette.focus,
                    }}
                    onPointerDown={(e) => begin(e, el, 'resize')}
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A press the chart's frame takes: anything but its own controls (Chart Options, Delete Chart, the resize corner) and
// the chart's indicators (a comment or an action opens as it does on the canvas).
function framePress(e: { target: EventTarget }): boolean {
  const t = e.target as { closest?: (selector: string) => unknown };
  return !t.closest?.('[data-sheet-chart-control], [data-indicators]');
}

// The rest of a press inside the chart view, kept from its canvas gestures. Never one on the frame itself: a drag's
// release lands there (pointer capture), and its own listener must hear it.
function viewPress(e: { target: EventTarget; currentTarget: EventTarget }): boolean {
  return e.target !== e.currentTarget && framePress(e);
}

// Undo and redo (Ctrl or ⌘ with Z, Shift for redo, or Ctrl+Y): the editor's, even from a selected chart.
function isUndoChord(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  const k = e.key.toLowerCase();
  return (e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y');
}

// The (dx, dy) an arrow key moves by, or null for any other key.
function arrowStep(key: string, n: number): { dx: number; dy: number } | null {
  if (key === 'ArrowLeft') return { dx: -n, dy: 0 };
  if (key === 'ArrowRight') return { dx: n, dy: 0 };
  if (key === 'ArrowUp') return { dx: 0, dy: -n };
  if (key === 'ArrowDown') return { dx: 0, dy: n };
  return null;
}

// A chart the canvas's view draws wears its own look; the frame adds only the selection ring, outside it.
function ringStyle(selected: boolean, palette: PlanPalette): CSSProperties {
  return selected ? { outline: `2px solid ${palette.focus}`, outlineOffset: 2 } : {};
}

// A chart drawn by its chart view alone (no canvas around the Sheet) sits on a card.
function cardStyle(selected: boolean, palette: PlanPalette): CSSProperties {
  return {
    backgroundColor: palette.surface,
    borderColor: selected ? palette.focus : palette.border,
    boxShadow: selected
      ? `0 0 0 1px ${palette.focus}, 0 4px 14px rgba(15, 23, 42, 0.14)`
      : '0 2px 8px rgba(15, 23, 42, 0.10)',
  };
}

// A selected chart's corner button, drawn as the Sheet's own controls are.
function ChartButton({
  label,
  palette,
  menu,
  onClick,
  children,
}: {
  label: string;
  palette: PlanPalette;
  menu?: boolean;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup={menu ? 'menu' : undefined}
        // A menu trigger: the open menu's outside-press close leaves this press to the button (a toggle).
        data-context-menu-trigger={menu ? '' : undefined}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          color: palette.text,
        }}
        onClick={onClick}
      >
        <span className="h-4 w-4">{children}</span>
      </button>
    </Tooltip>
  );
}

function chartName(el: ShapeElement): string {
  return CHART_TYPE_LABELS[chartTypeOf(el) ?? 'column'];
}
