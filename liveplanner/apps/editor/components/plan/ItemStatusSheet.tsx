'use client';

// The status pill's sheet (docs/specs/026-plan/plan-board.md "status pill"): over the card panel on a phone, the
// grab handle, the card's title small and muted, then its columns as large rows in board order, the current one
// ticked, and the done columns in a group of their own below a hairline. A pick, a swipe down, a press outside or
// Escape slides it away; Escape never reaches the card panel.
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, useClickOutside, useEscape } from '@liveplanner/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import type { StatusOption } from './status-options';

// Marks the pill, so a press on it is not an outside one (it toggles the sheet itself).
export const STATUS_PILL_ATTR = 'data-status-pill';

export function ItemStatusSheet({
  title,
  current,
  open,
  done,
  dotOf,
  onPick,
  onClose,
}: {
  title: string;
  current: string;
  open: readonly StatusOption[];
  done: readonly StatusOption[];
  dotOf: (status: string) => string;
  // A column picked other than the current one; the sheet slides away after.
  onPick: (status: string) => void;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const leave = () => setClosing(true);
  useClickOutside(sheet, leave, !closing, `[${STATUS_PILL_ATTR}]`);
  useEscape(leave, { capture: true, stopPropagation: true });
  // Focus lands on the current column (else the first), so a keyboard or a screen reader starts where the card is.
  useEffect(() => {
    const rows = sheet.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const at =
      [...(rows ?? [])].find((r) => r.getAttribute('aria-checked') === 'true') ?? rows?.[0];
    at?.focus({ preventScroll: true });
  }, []);
  const pick = (status: string) => {
    if (status !== current) onPick(status);
    leave();
  };
  const row = (o: StatusOption) => {
    const on = o.status === current;
    return (
      <button
        key={o.status}
        type="button"
        role="radio"
        aria-checked={on}
        disabled={!!o.excluded && !on}
        onClick={() => pick(o.status)}
        className={`flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] transition-colors hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none active:bg-slate-100 disabled:cursor-default disabled:opacity-60 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800 dark:active:bg-slate-800 ${
          on
            ? 'font-semibold text-slate-900 dark:text-slate-50'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotOf(o.status) }}
        />
        <span className="min-w-0 flex-1 truncate">{o.name}</span>
        {on ? (
          <span aria-hidden className="shrink-0 text-brand-700 dark:text-brand-400">
            <CheckIcon size={16} />
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <BottomSheet
      ref={sheet}
      role="dialog"
      aria-label="Move Card"
      onClose={onClose}
      closing={closing}
      zClassName="z-[var(--z-popover)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="truncate px-4 pb-2 pt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <div role="radiogroup" aria-label="Columns">
        {open.map(row)}
      </div>
      {done.length > 0 ? (
        <>
          <hr className="mx-4 my-1.5 border-slate-200 dark:border-slate-700" />
          <div role="radiogroup" aria-label="Done Columns">
            {done.map(row)}
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}
