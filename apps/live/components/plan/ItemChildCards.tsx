'use client';

// The cards that point at the open card (docs/specs/026-plan/item-types.md "Card fields"): a Project's Child
// Cards (the cards naming it as their Parent), and a section per Card field that links here ("Linked as Owner"),
// each row opening that card in the panel, with a button to make a new one already linked. The host computes
// the groups (linkedCardsOf in packages/items), so this only draws them.
import { useId } from 'react';
import {
  isArchived,
  itemAssignee,
  itemStatus,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { ChevronRightIcon, PlusIcon } from '@livediagram/ui';
import type { LinkedGroup } from '@livediagram/items';
import { PersonDisc } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

const CHIP =
  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset whitespace-nowrap';

export function ItemChildCards({
  item,
  childCards,
  types,
  statusNames,
  onOpen,
}: {
  item: Item;
  childCards: readonly Item[];
  types: readonly ItemTypeDef[];
  // Each status's column name, for a row's status chip.
  statusNames: ReadonlyMap<string, string>;
  onOpen: (itemId: string) => void;
}) {
  const headingId = useId();
  // Only a Project offers the empty state: any other type with no children has nothing to say.
  if (childCards.length === 0 && item.type !== 'project') return null;
  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h3
        id={headingId}
        className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
      >
        Child Cards
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {childCards.length}
        </span>
      </h3>
      {childCards.length === 0 ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          No cards sit under this project yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/40">
          {childCards.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              types={types}
              statusNames={statusNames}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// One card pointing here: its glyph, number, title, Archived, status and assignee; pressed, it opens.
function ChildRow({
  child,
  types,
  statusNames,
  onOpen,
}: {
  child: Item;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  onOpen: (itemId: string) => void;
}) {
  const type = typeIn(types, child.type);
  const status = itemStatus(child);
  const statusName = status ? (statusNames.get(status) ?? status) : 'No status';
  const assignee = itemAssignee(child);
  const title = itemTitle(child);
  return (
    <li key={child.id}>
      <button
        type="button"
        aria-label={`Open #${child.key} ${title}, ${statusName}`}
        onClick={() => onOpen(child.id)}
        className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
      >
        <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
          <PlanTypeGlyph glyph={type.glyph} size={14} />
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          #{child.key}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {title}
        </span>
        {isArchived(child) ? (
          <span
            className={`${CHIP} bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`}
          >
            Archived
          </span>
        ) : null}
        <span
          className={`${CHIP} max-w-[9rem] truncate bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700`}
        >
          {statusName}
        </span>
        {assignee ? <PersonDisc person={assignee} /> : null}
        <span className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 motion-reduce:transition-none dark:text-slate-600 dark:group-hover:text-slate-300">
          <ChevronRightIcon size={12} />
        </span>
      </button>
    </li>
  );
}

// A Card field's section on the card it links to: "Linked as Owner", its cards, and "+ New Objective" (one button
// per type whose field links here) making one already linked.
export function LinkedCardGroup({
  group,
  types,
  statusNames,
  canAdd,
  onOpen,
  onAdd,
}: {
  group: LinkedGroup;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  canAdd: boolean;
  onOpen: (itemId: string) => void;
  onAdd: (typeId: string) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h3
        id={headingId}
        className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
      >
        Linked as {group.label}
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {group.cards.length}
        </span>
      </h3>
      {group.cards.length === 0 ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          No cards link here as {group.label} yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/40">
          {group.cards.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              types={types}
              statusNames={statusNames}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
      {canAdd ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {group.fromTypes.map((typeId) => {
            const type = typeIn(types, typeId);
            return (
              <button
                key={typeId}
                type="button"
                onClick={() => onAdd(typeId)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                <PlusIcon size={12} />
                New {type.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
