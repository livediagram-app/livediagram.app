'use client';

// Setup Board's chosen columns (docs/specs/026-plan/plan-board.md "Setup Board"), top to bottom as the board shows
// them left to right, each reordered by dragging its grip. While a column is dragged the list shows where it will
// land (a dashed slot in the brand colour, the others closing up around it) and a lifted copy follows the pointer;
// release places it, Escape or a cancelled pointer puts it back. Alt+Up and Alt+Down on a grip move its column by
// keyboard. Pointer events, so a mouse, a pen and a finger drag alike.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CloseIcon } from '@livediagram/ui';
import { GripIcon } from './ItemTypeFieldMenu';
import { HANDLE_TOUCH, reorderSlot } from '@/components/primitives/useHandleReorder';
import type { PlanPalette } from './plan-palette';
import { setupColumnKey, type SetupColumn } from './setup-board';

type Drag = {
  from: number;
  over: number;
  startY: number;
  y: number;
  // Each row's middle when the drag began, and the dragged row's box (for the lifted copy).
  mids: number[];
  box: { left: number; top: number; width: number; height: number };
};

// The list with one column moved from `from` to `to`.
export function moveColumn<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [c] = next.splice(from, 1);
  next.splice(to, 0, c!);
  return next;
}

export function SetupColumnList({
  chosen,
  palette,
  onChange,
}: {
  chosen: readonly SetupColumn[];
  palette: PlanPalette;
  onChange: (next: SetupColumn[]) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // Removes the window listeners of a drag under way (Escape, or unmounting, ends it).
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const set = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // Escape while dragging puts the column back.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      stopRef.current?.();
      set(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);

  const start = (i: number, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || chosen.length < 2 || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('[data-setup-column]')];
    const boxes = rows.map((r) => r.getBoundingClientRect());
    const box = boxes[i];
    if (!box) return;
    e.preventDefault();
    // Followed on the window: the dragged row (and its grip) gives way to the slot as the drag starts.
    const onMove = (ev: PointerEvent) => move(ev.clientY);
    const onUp = () => {
      stop();
      end();
    };
    const onCancel = () => {
      stop();
      set(null);
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      stopRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    stopRef.current = stop;
    set({
      from: i,
      over: i,
      startY: e.clientY,
      y: e.clientY,
      mids: boxes.map((b) => b.top + b.height / 2),
      box: { left: box.left, top: box.top, width: box.width, height: box.height },
    });
  };
  const move = (y: number) => {
    const d = dragRef.current;
    if (!d) return;
    set({ ...d, y, over: reorderSlot(d.mids, d.from, y - d.startY) });
  };
  const end = () => {
    const d = dragRef.current;
    if (!d) return;
    set(null);
    if (d.over !== d.from) onChange(moveColumn(chosen, d.from, d.over));
  };

  // While dragging, the others close up and a slot opens where the dragged one will land.
  const shown: (SetupColumn | 'slot')[] = drag
    ? moveColumn<SetupColumn | 'slot'>(
        chosen.map((c, i) => (i === drag.from ? 'slot' : c)),
        drag.from,
        drag.over,
      )
    : [...chosen];
  const dragged = drag ? chosen[drag.from] : undefined;

  return (
    <>
      <ol ref={listRef} aria-label="Columns" className="flex flex-col gap-1.5">
        {shown.map((c, i) =>
          c === 'slot' ? (
            <li
              key="slot"
              aria-hidden
              data-setup-column
              className="rounded-lg border-2 border-dashed border-brand-400 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10"
              style={{ height: drag?.box.height }}
            />
          ) : (
            <li
              key={setupColumnKey(c)}
              data-setup-column
              className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{ borderColor: palette.cardBorder, backgroundColor: palette.card }}
            >
              <ColumnRow
                column={c}
                palette={palette}
                grip={{
                  'aria-label': `Move ${c.name}`,
                  onPointerDown: (e) => start(i, e),
                  onKeyDown: (e) => {
                    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                    const to = i + (e.key === 'ArrowUp' ? -1 : 1);
                    if (to < 0 || to >= chosen.length) return;
                    e.preventDefault();
                    onChange(moveColumn(chosen, i, to));
                  },
                }}
                onRemove={() => onChange(chosen.filter((_, j) => j !== i))}
              />
            </li>
          ),
        )}
      </ol>
      {/* The lifted copy, following the pointer. */}
      {drag && dragged ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[var(--z-overlay)] flex items-center gap-2 rounded-lg border border-brand-400 px-2 py-1.5 shadow-lg ring-2 ring-brand-500/20"
          style={{
            left: drag.box.left,
            top: drag.box.top + (drag.y - drag.startY),
            width: drag.box.width,
            backgroundColor: palette.card,
          }}
        >
          <ColumnRow column={dragged} palette={palette} />
        </div>
      ) : null}
    </>
  );
}

// One column: its grip, name, whether it is an existing state or new, and its remove cross.
function ColumnRow({
  column,
  palette,
  grip,
  onRemove,
}: {
  column: SetupColumn;
  palette: PlanPalette;
  grip?: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string };
  onRemove?: () => void;
}) {
  return (
    <>
      <button
        type="button"
        {...grip}
        className={`flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing ${HANDLE_TOUCH}`}
        style={{ color: palette.muted }}
      >
        <GripIcon />
      </button>
      <span
        className="min-w-0 flex-1 truncate text-[13px] font-semibold"
        style={{ color: palette.text }}
      >
        {column.name}
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: palette.muted }}>
        {column.kind === 'existing' ? 'Existing state' : 'New'}
      </span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${column.name}`}
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: palette.muted }}
        >
          <CloseIcon size={10} />
        </button>
      ) : (
        <span className="h-6 w-6 shrink-0" />
      )}
    </>
  );
}
