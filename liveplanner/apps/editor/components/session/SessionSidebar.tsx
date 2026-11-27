'use client';

// A Session tab's queue (docs/specs/026-plan/session-tabs.md "The sidebar"): a listbox of the queued cards in order,
// each with its place, number, title and its type's colour as an edge. The room's card reads in the accent's tint; a
// decided card is greyed with its outcome's glyph for a number. Pressing a row opens it (the facilitator's press moves
// the room; anyone else's is a peek). Up and Down move between rows, Enter opens one.
import { useRef, type KeyboardEvent } from 'react';
import { itemTitle, typeIn, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { cardRefIn } from '@/components/plan/card-ref';
import { OUTCOME_LOOKS } from './session-kinds';

export function SessionSidebar({
  label,
  list,
  types,
  decided,
  currentId,
  shownId,
  onOpen,
}: {
  label: string;
  list: readonly Item[];
  types: readonly ItemTypeDef[];
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  // The room's card, and the card this screen shows (a peek's, else the room's).
  currentId: string | null;
  shownId: string | null;
  onOpen: (itemId: string) => void;
}) {
  const refOf = cardRefIn(types);
  const listRef = useRef<HTMLUListElement>(null);
  const focusRow = (at: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    rows?.[Math.max(0, Math.min(rows.length - 1, at))]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLLIElement>, at: number, id: string) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(at + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(id);
    }
  };
  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={`${label} queue`}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3"
    >
      {list.map((item, at) => {
        const outcome = decided?.[item.id]?.outcome;
        const look = outcome ? OUTCOME_LOOKS[outcome] : null;
        const isCurrent = item.id === currentId;
        const isShown = item.id === shownId;
        const colour = typeIn(types, item.type).color;
        return (
          <li
            key={item.id}
            role="option"
            aria-selected={isShown}
            aria-current={isCurrent ? 'step' : undefined}
            tabIndex={isShown ? 0 : -1}
            data-session-row={item.id}
            onClick={() => onOpen(item.id)}
            onKeyDown={(e) => onKey(e, at, item.id)}
            className={`group relative flex cursor-pointer items-center gap-2.5 rounded-lg border py-2 pl-3 pr-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isCurrent
                ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40'
                : isShown
                  ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
            } ${outcome && !isCurrent ? 'opacity-60' : ''}`}
          >
            <span
              aria-hidden
              className="absolute inset-y-2 left-0 w-[3px] rounded-full"
              style={{ backgroundColor: colour }}
            />
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                isCurrent && !look
                  ? 'bg-brand-700 text-white dark:bg-brand-600'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
              style={look ? { color: look.colour } : undefined}
            >
              {look ? (
                <>
                  <look.Icon size={13} aria-hidden />
                  <span className="sr-only">{look.done}</span>
                </>
              ) : (
                <span className="text-optical-centre">{at + 1}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {refOf(item)}
              </span>
              <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                {itemTitle(item)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
