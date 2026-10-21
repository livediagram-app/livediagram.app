'use client';

// One Dashboard row (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): its slots side by side on a grid of twelfths,
// the dividers between them and the handle under it (an Editor drags them: the slots' spans or the row's height move
// live, and the change lands as one step when the drag ends). Slots come and go one at a time (the palette's Slot, a
// slot's Remove Slot), so a row has no tools of its own.
import {
  memo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DASHBOARD_ROW_H_MAX,
  DASHBOARD_ROW_H_MIN,
  DASHBOARD_SPAN_MIN,
  DASHBOARD_SPANS,
  moveDashboardDivider,
  setDashboardRowHeight,
  type DashboardRow,
} from '@liveplanner/document';
import { useDashboard } from './dashboard-context';
import { DashboardSlotView } from './DashboardSlotView';
import { useBoxSize } from './DashboardSlotContent';
import { isCondensed, phoneSlotSize, phoneSlotStyle } from './condense';
import { rowHeightFloor, slotWidthFloor, spanPx as slotPx } from '@/hooks/plan/slot-fit';

const GAP_PX = 12;
// A row's height from the keyboard (its resize handle focused): an arrow moves it this far, Shift and an arrow further.
// A divider moves one twelfth per arrow.
export const ROW_KEY_STEP_PX = 20;
export const ROW_KEY_STEP_BIG_PX = 80;
// What a focused handle shows (it hides with the pointer away otherwise).
const HANDLE_FOCUS =
  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full';

// A touch screen has no hover to reveal the handles (plan-tabs.md "Editing"): each is a quiet marker, always shown,
// with a finger's reach (24 px across, centred on the gap) only around its bar, so the slots' own edges stay theirs.
const TOUCH_DIVIDER =
  '[@media(hover:none)]:top-1/2 [@media(hover:none)]:h-16 [@media(hover:none)]:w-6 [@media(hover:none)]:-translate-y-1/2 [@media(hover:none)]:opacity-50';
const TOUCH_ROW_HANDLE =
  '[@media(hover:none)]:-bottom-[18px] [@media(hover:none)]:left-1/2 [@media(hover:none)]:h-6 [@media(hover:none)]:w-16 [@media(hover:none)]:-translate-x-1/2 [@media(hover:none)]:opacity-50';

type Drag =
  | { kind: 'divider'; index: number; startX: number; spanPx: number; delta: number }
  | { kind: 'height'; startY: number; start: number; height: number };

// Memoised: the page re-renders on every drag-over and slot-move pointer event (its zone outline), and a row with live
// boards in its slots should redraw only when the row itself or the dashboard context changes.
export const DashboardRowView = memo(function DashboardRowView({
  row,
  index,
  rowCount,
}: {
  row: DashboardRow;
  index: number;
  rowCount: number;
}) {
  const { canEdit, actions, fit, elements } = useDashboard();
  const gridRef = useRef<HTMLDivElement>(null);
  // On a phone the row's slots stack, full width, each sized for what it holds (condense.ts); nothing is resized
  // there, and the stored spans and height stay.
  const box = useBoxSize(gridRef);
  const condensed = isCondensed(box?.width);
  const fills = !!row.fill && !condensed;
  const [drag, setDrag] = useState<Drag | null>(null);
  // What the row shows while a drag is under way: the spans or height it would land on.
  const shown =
    drag?.kind === 'divider'
      ? moveDashboardDivider({ rows: [row] }, row.id, drag.index, drag.delta).rows[0]!
      : drag?.kind === 'height'
        ? setDashboardRowHeight({ rows: [row] }, row.id, drag.height).rows[0]!
        : row;
  const begin = (e: ReactPointerEvent<HTMLElement>, next: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(next);
  };
  // A drag stops where it would squeeze a slot's content below what it needs (plan-tabs.md "Filling a slot"): a row
  // no shorter than its tallest-needing content, a divider no nearer a slot's side than its content's width.
  const width = box?.width ?? 0;
  const guarded = !!fit && !condensed && width > 0;
  const clampDelta = (index: number, delta: number) => {
    if (!guarded) return delta;
    const left = row.slots[index]!;
    const right = row.slots[index + 1]!;
    let d = delta;
    while (d < 0 && slotPx(left.span + d, width) < slotWidthFloor(left, fit.fitOf)) d += 1;
    while (d > 0 && slotPx(right.span - d, width) < slotWidthFloor(right, fit.fitOf)) d -= 1;
    return d;
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    if (drag.kind === 'divider')
      setDrag({
        ...drag,
        delta: clampDelta(drag.index, Math.round((e.clientX - drag.startX) / drag.spanPx)),
      });
    else {
      const floor = guarded ? Math.min(rowHeightFloor(row, fit.fitOf), drag.start) : 0;
      setDrag({ ...drag, height: Math.max(floor, drag.start + (e.clientY - drag.startY)) });
    }
  };
  const end = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'divider' && d.delta !== 0)
      actions.changeDashboard(
        (l) => moveDashboardDivider(l, row.id, d.index, d.delta),
        'DashboardSlot',
      );
    if (d.kind === 'height' && Math.round(d.height) !== row.height)
      actions.changeDashboard((l) => setDashboardRowHeight(l, row.id, d.height), 'DashboardRow');
  };
  const spanPx = () => ((gridRef.current?.offsetWidth ?? 1200) + GAP_PX) / DASHBOARD_SPANS;
  // From the keyboard (plan-tabs.md "Dashboard tab"): Left and Right move a divider a twelfth, Up and Down a row's
  // height; each press is one step, held to what the content needs as a drag is.
  const dividerKey = (e: ReactKeyboardEvent<HTMLElement>, index: number) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    const d = clampDelta(index, delta);
    if (d !== 0)
      actions.changeDashboard((l) => moveDashboardDivider(l, row.id, index, d), 'DashboardSlot');
  };
  const heightKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    const floor = guarded ? Math.min(rowHeightFloor(row, fit.fitOf), row.height) : 0;
    const height = Math.max(
      floor,
      row.height + dir * (e.shiftKey ? ROW_KEY_STEP_BIG_PX : ROW_KEY_STEP_PX),
    );
    if (Math.round(height) !== row.height)
      actions.changeDashboard((l) => setDashboardRowHeight(l, row.id, height), 'DashboardRow');
  };
  // Where the divider after slot `i` sits, as a share of the row (between the two slots' gap).
  const dividers = shown.slots.slice(0, -1).map((_, i) => ({
    i,
    at: shown.slots.slice(0, i + 1).reduce((sum, s) => sum + s.span, 0),
  }));
  return (
    <section
      aria-label={`Row ${index + 1} of ${rowCount}`}
      data-dashboard-row={row.id}
      // A row that fills the page (a full-screen visualisation) takes the height the page has left, never less than
      // 24 rem.
      className={`group/row relative ${fills ? 'flex min-h-96 flex-1 flex-col' : ''}`}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
    >
      {/* On a wide page a flex row whose slots' widths ease from one span to the next (a divider dragged, a slot
          added or removed) and whose height eases (not while its own edge is dragged, which follows the pointer);
          on a phone, its slots one under another (condense.ts). */}
      <div
        ref={gridRef}
        className={
          condensed
            ? 'flex flex-col'
            : `flex ${drag?.kind === 'height' ? '' : 'transition-[height] duration-short ease-out motion-reduce:transition-none'}`
        }
        style={
          condensed
            ? { gap: GAP_PX }
            : fills
              ? { flex: '1 1 0', minHeight: 0, gap: GAP_PX }
              : { height: shown.height, gap: GAP_PX }
        }
      >
        {shown.slots.map((slot, i) => (
          <DashboardSlotView
            key={slot.id}
            rowId={row.id}
            slot={slot}
            at={{ slot: i, row: index, slots: row.slots.length }}
            span={slot.span}
            {...(condensed
              ? {
                  phone: phoneSlotStyle(
                    phoneSlotSize(
                      slot.content,
                      slot.content?.type === 'element'
                        ? (elements.get(slot.content.elementId) as
                            { shape?: string; planView?: { view?: string } } | undefined)
                        : undefined,
                    ),
                  ),
                }
              : {})}
          />
        ))}
      </div>
      {canEdit ? (
        <>
          {(condensed ? [] : dividers).map(({ i, at }) => (
            <div
              key={i}
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label={`Resize slots ${i + 1} and ${i + 2}`}
              // The left slot's twelfths, between the least each side keeps.
              aria-valuenow={shown.slots[i]!.span}
              aria-valuemin={DASHBOARD_SPAN_MIN}
              aria-valuemax={shown.slots[i]!.span + shown.slots[i + 1]!.span - DASHBOARD_SPAN_MIN}
              aria-valuetext={`${shown.slots[i]!.span} of ${DASHBOARD_SPANS} twelfths`}
              onKeyDown={(e) => dividerKey(e, i)}
              // On a touch screen it waits for no hover: a quiet marker always shown, a finger wide and its bar's height
              // tall in the middle of the gap, taking the finger rather than scrolling the page.
              className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center opacity-0 transition-opacity duration-micro ease-out hover:opacity-100 group-hover/row:opacity-60 motion-reduce:transition-none ${TOUCH_DIVIDER} ${drag?.kind === 'divider' && drag.index === i ? '!opacity-100' : ''} ${HANDLE_FOCUS}`}
              // The middle of the gap after `at` twelfths: at/12 of the row, less the half gap the columns before it give up.
              style={{
                left: `calc(${(at / DASHBOARD_SPANS) * 100}% + ${(at / DASHBOARD_SPANS) * GAP_PX - GAP_PX / 2}px)`,
              }}
              onPointerDown={(e) =>
                begin(e, {
                  kind: 'divider',
                  index: i,
                  startX: e.clientX,
                  spanPx: spanPx(),
                  delta: 0,
                })
              }
            >
              <span className="h-10 w-1 scale-y-50 rounded-full bg-brand-500 transition-[scale] duration-micro ease-out group-hover/row:scale-y-100 motion-reduce:scale-y-100 motion-reduce:transition-none [@media(hover:none)]:scale-y-100" />
            </div>
          ))}
          {fills || condensed ? null : (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-label={`Resize row ${index + 1}`}
              aria-valuenow={shown.height}
              aria-valuemin={DASHBOARD_ROW_H_MIN}
              aria-valuemax={DASHBOARD_ROW_H_MAX}
              aria-valuetext={`${shown.height} pixels tall`}
              onKeyDown={heightKey}
              // On a touch screen, as a divider: a quiet marker always shown, a finger tall and its bar's width wide.
              className={`absolute -bottom-2.5 left-0 z-10 flex h-3 w-full cursor-row-resize touch-none items-center justify-center opacity-0 transition-opacity duration-micro ease-out hover:opacity-100 group-hover/row:opacity-60 motion-reduce:transition-none ${TOUCH_ROW_HANDLE} ${drag?.kind === 'height' ? '!opacity-100' : ''} ${HANDLE_FOCUS}`}
              onPointerDown={(e) =>
                begin(e, {
                  kind: 'height',
                  startY: e.clientY,
                  start: row.height,
                  height: row.height,
                })
              }
            >
              <span className="h-1 w-10 scale-x-50 rounded-full bg-brand-500 transition-[scale] duration-micro ease-out group-hover/row:scale-x-100 motion-reduce:scale-x-100 motion-reduce:transition-none [@media(hover:none)]:scale-x-100" />
            </div>
          )}
        </>
      ) : null}
    </section>
  );
});
