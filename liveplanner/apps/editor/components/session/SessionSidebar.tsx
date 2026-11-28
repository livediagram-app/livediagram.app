'use client';

// A Session tab's queue (docs/specs/026-plan/session-tabs.md "The sidebar"): a listbox of the queued cards in order,
// each with its place, number, title and its type's colour as an edge. The room's card reads in the accent's tint; a
// decided card is greyed with its outcome's glyph for a number. Pressing a row opens it (the facilitator's press moves
// the room; anyone else's is a peek). Up and Down move between rows, Enter opens one. `SessionRow` and `useRowKeys`
// are every kind's (Stand-up's sidebar groups the same rows by person).
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
  type SessionOutcome,
} from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { cardRefIn } from '@/components/plan/card-ref';
import { OUTCOME_LOOKS } from './session-kinds';

// Up and Down move between a listbox's rows (across a Stand-up's people too); Enter or Space opens one.
export function useRowKeys(onOpen: (itemId: string) => void) {
  const listRef = useRef<HTMLUListElement>(null);
  const onKey = (e: KeyboardEvent<HTMLElement>, id: string) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const at = rows.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1);
      rows[Math.max(0, Math.min(rows.length - 1, at))]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(id);
    }
  };
  return { listRef, onKey };
}

// One queued card's row: its place (or its outcome's glyph once decided), number, title and its type's colour as an
// edge; the room's card in the accent's tint, the card this screen shows outlined, a decided one greyed.
export function SessionRow({
  item,
  place,
  refText,
  colour,
  outcome,
  isCurrent,
  isShown,
  sub,
  aside,
  onOpen,
  onKey,
}: {
  item: Item;
  // Its place in the queue, shown until it is decided.
  place: number;
  refText: string;
  colour: string;
  outcome: SessionOutcome | undefined;
  isCurrent: boolean;
  isShown: boolean;
  // Words after its number (a Stand-up card's stage).
  sub?: string | undefined;
  aside?: ReactNode;
  onOpen: (itemId: string) => void;
  onKey: (e: KeyboardEvent<HTMLElement>, itemId: string) => void;
}) {
  const look = outcome ? OUTCOME_LOOKS[outcome] : null;
  return (
    <li
      role="option"
      aria-selected={isShown}
      aria-current={isCurrent ? 'step' : undefined}
      tabIndex={isShown ? 0 : -1}
      data-session-row={item.id}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => onKey(e, item.id)}
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
          <span className="text-optical-centre">{place}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {refText}
          {sub ? ` · ${sub}` : ''}
        </span>
        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {itemTitle(item)}
        </span>
      </span>
      {aside}
    </li>
  );
}

export function SessionSidebar({
  label,
  list,
  types,
  decided,
  currentId,
  shownId,
  onOpen,
  aside,
}: {
  label: string;
  list: readonly Item[];
  types: readonly ItemTypeDef[];
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  // The room's card, and the card this screen shows (a peek's, else the room's).
  currentId: string | null;
  shownId: string | null;
  onOpen: (itemId: string) => void;
  // A kind's own mark at a row's end (Sprint Planning's estimate pill).
  aside?: ((item: Item) => ReactNode) | undefined;
}) {
  const refOf = cardRefIn(types);
  const { listRef, onKey } = useRowKeys(onOpen);
  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={`${label} queue`}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3"
    >
      {list.map((item, at) => (
        <SessionRow
          key={item.id}
          item={item}
          place={at + 1}
          refText={refOf(item)}
          colour={typeIn(types, item.type).color}
          outcome={decided?.[item.id]?.outcome}
          isCurrent={item.id === currentId}
          isShown={item.id === shownId}
          aside={aside?.(item)}
          onOpen={onOpen}
          onKey={onKey}
        />
      ))}
    </ul>
  );
}
