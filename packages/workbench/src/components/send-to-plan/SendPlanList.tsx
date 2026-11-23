'use client';

// The picker's plans (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker" step 1): the person's plans, the
// most recent across every app first, searchable, with New Plan at the top. A plan they can only view stays listed,
// locked and saying so. Arrow keys move along the list; Enter or Space picks.
import { useState, type KeyboardEvent } from 'react';
import type { Item } from '@liveworkspace/index-client';
import {
  Button,
  CompactEmptyState,
  NoMatches,
  PlanIcon,
  TextInput,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideLock, lucidePlus } from '@liveworkspace/icons/lucide';
import { SearchInput } from '../primitives/SearchInput';

const PlusGlyph = lucideGlyph(lucidePlus, 16);
const LockGlyph = lucideGlyph(lucideLock, 13);

export type PlanList =
  { state: 'loading' } | { state: 'ready'; items: Item[] } | { state: 'failed' };

const ROW =
  'flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:min-h-9';
const ROW_IDLE = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70';
const ROW_ON =
  'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-slate-800 dark:text-white dark:ring-brand-400/60';
const ROW_LOCKED = 'cursor-not-allowed text-slate-400 dark:text-slate-400';

// Arrow keys between the list's buttons.
function moveFocus(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-plan-row]')];
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    buttons[Math.min(buttons.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))];
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

export function SendPlanList({
  plans,
  query,
  onQuery,
  pickedId,
  onPick,
  newName,
  onCreate,
  creating,
}: {
  plans: PlanList;
  query: string;
  onQuery: (q: string) => void;
  pickedId: string | null;
  onPick: (item: Item) => void;
  // New Plan's name to start from ("Plans from <source>").
  newName: string;
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const [naming, setNaming] = useState<string | null>(null);

  const create = (typed: string) => {
    const name = typed.trim();
    if (!name) return;
    // The row closes once asked, so a second press never makes a second plan.
    setNaming(null);
    onCreate(name);
  };

  const list =
    plans.state === 'loading' ? (
      <div
        className="flex flex-col gap-1.5 p-1"
        role="status"
        aria-busy="true"
        aria-label="Loading your plans"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
          />
        ))}
      </div>
    ) : plans.state === 'failed' ? (
      <CompactEmptyState
        size="small"
        icon={<PlanIcon />}
        title="Couldn't load your plans"
        description="Check your connection and try again."
      />
    ) : plans.items.length === 0 ? (
      query ? (
        <NoMatches things="plans" query={query} onClear={() => onQuery('')} />
      ) : (
        <CompactEmptyState
          size="small"
          icon={<PlanIcon />}
          title="No plans yet"
          description="Make one with New Plan, and the card goes in it."
        />
      )
    ) : (
      <ul className="flex flex-col gap-0.5" aria-label="Your plans" onKeyDown={moveFocus}>
        {plans.items.map((p) => {
          const locked = p.access !== 'edit';
          const on = p.id === pickedId;
          return (
            <li key={p.id}>
              <button
                type="button"
                data-plan-row=""
                aria-pressed={on}
                aria-disabled={locked || undefined}
                aria-describedby={locked ? `locked-${p.id}` : undefined}
                onClick={() => !locked && onPick(p)}
                className={`${ROW} ${locked ? ROW_LOCKED : on ? ROW_ON : ROW_IDLE}`}
              >
                <PlanIcon size={16} className="shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{p.title || 'Untitled plan'}</span>
                {locked ? (
                  <span
                    id={`locked-${p.id}`}
                    className="flex shrink-0 items-center gap-1 text-[11px]"
                  >
                    <LockGlyph aria-hidden />
                    You can&apos;t add cards
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex">
        <SearchInput
          value={query}
          onChange={onQuery}
          placeholder="Search your plans"
          ariaLabel="Search your plans"
          clearAriaLabel="Clear the search"
          clearDescription="Clear the plan search."
          size="row"
        />
      </div>
      {naming === null ? (
        <button
          type="button"
          data-plan-row=""
          disabled={creating}
          onClick={() => setNaming(newName)}
          className={`${ROW} ${ROW_IDLE} font-medium text-brand-700 disabled:cursor-default disabled:opacity-60 dark:text-brand-200`}
        >
          <PlusGlyph aria-hidden />
          New Plan
        </button>
      ) : (
        // Not a <form>: the row sits inside the dialog's own form, and a nested form submits the page.
        <div
          role="group"
          aria-label="New Plan"
          className="flex items-center gap-2 rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800/60"
        >
          <TextInput
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setNaming(null);
              } else if (e.key === 'Enter') {
                // Enter makes the plan; it never sends the card the dialog's form holds.
                e.preventDefault();
                e.stopPropagation();
                create(naming);
              }
            }}
            maxLength={120}
            aria-label="New plan's name"
            compact
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => create(naming)}
            disabled={!naming.trim()}
            className="shrink-0"
          >
            Make
          </Button>
        </div>
      )}
      <div className="max-h-64 min-h-24 overflow-y-auto sm:max-h-72">{list}</div>
    </div>
  );
}
