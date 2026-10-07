'use client';

// Drawing dates on a project that has none (docs/specs/026-plan/plan-views.md "Drawing dates"): over its row the
// timeline shows a dashed week from the day under the pointer; a click gives the project that week, a drag the
// days it spans. Either is one change (start and due together), after which the bar's ends resize as any bar's.
// Escape or a cancelled pointer drops a draw.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import {
  ganttAt,
  ganttDayAt,
  ganttDrawn,
  type GanttModel,
  type GanttRow,
  type ItemPatch,
} from '@livediagram/items';
import { tint } from '../plan-card-parts';
import { ganttDayLabel, swallowNextClick } from './gantt-drag';

export function GanttDrawRow({
  row,
  view,
  trackRef,
  colour,
  onCommit,
  onBegin,
}: {
  row: GanttRow;
  view: Pick<GanttModel, 'from' | 'to'>;
  // The timeline, whose box turns a pointer into a day.
  trackRef: RefObject<HTMLElement | null>;
  colour: string;
  onCommit: (itemId: string, patch: ItemPatch) => void;
  // A draw begins (the chart pins its timeline).
  onBegin?: () => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [draw, setDraw] = useState<{ a: number; b: number } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  // A draw in flight when the row goes (the project got dates elsewhere) ends with it, unwritten.
  useEffect(() => () => stop.current?.(), []);

  const dayAt = (clientX: number): number | null => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return null;
    return ganttDayAt(view, (clientX - box.left) / box.width);
  };

  const begin = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const a = dayAt(e.clientX);
    if (a === null) return;
    e.stopPropagation();
    e.preventDefault();
    onBegin?.();
    let b = a;
    setDraw({ a, b });
    const onMove = (ev: PointerEvent) => {
      const day = dayAt(ev.clientX);
      if (day === null || day === b) return;
      b = day;
      setDraw({ a, b });
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      stop.current = null;
      setDraw(null);
      // A drag across days can be let go over another row: its click must not open that card.
      if (b !== a) swallowNextClick();
      if (commit) onCommit(row.item.id, { set: ganttDrawn(a, b).set });
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      end(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    stop.current = () => end(false);
  };

  const ghost = draw
    ? ganttDrawn(draw.a, draw.b)
    : hover !== null
      ? ganttDrawn(hover, hover)
      : null;
  const left = ghost ? ganttAt(view, ghost.from) * 100 : 0;
  const width = ghost ? (ganttAt(view, ghost.to + 1) - ganttAt(view, ghost.from)) * 100 : 0;
  return (
    <span
      aria-hidden
      data-gantt-draw
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerMove={(e) => {
        if (!draw) setHover(dayAt(e.clientX));
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={begin}
      // A press here draws; it never opens the card (the row's name does).
      onClick={(e) => e.stopPropagation()}
    >
      {ghost ? (
        <span
          className="pointer-events-none absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full border border-dashed"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            borderColor: colour,
            backgroundColor: tint(colour, draw ? 30 : 14),
          }}
        />
      ) : null}
      {draw && ghost ? (
        <span
          className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow ${IDENTITY_FILL}`}
          style={{ ...identityVars(colour), left: `${left + width / 2}%`, top: -14 }}
        >
          {ganttDayLabel(ghost.from)} → {ganttDayLabel(ghost.to)}
        </span>
      ) : null}
    </span>
  );
}
