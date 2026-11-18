'use client';

// The open card's blockers in the item panel (docs/specs/026-plan/item-types.md "Blocked By"): a section per Blocked
// By field the type offers that holds a live blocker, on the type's first tab before its Comments (the Linked as
// sections are on the Linked Cards tab). Each row is the blocker's glyph, number, title and state, a tick when it is
// done; pressed, it opens. Under an open blocker the card starts before, an amber line says so (docs/specs/026-plan/
// plan-views.md "Dependency clashes"). Read-only: the field's own control is where a link is set.
import { useId } from 'react';
import { cardRefIn } from './card-ref';
import {
  blocksFieldsOf,
  clashText,
  clashesOf,
  donePhase,
  isArchived,
  isTrashed,
  itemTitle,
  linkedCard,
  linkedCardIds,
  namedStatus,
  typeIn,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { CheckIcon, ChevronRightIcon } from '@liveplanner/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import { usePlan } from './PlanContext';
import { planBlocking } from './blocking';
import { ClashGlyph } from './views/clash-glyph';

const CHIP =
  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset whitespace-nowrap';

// Each Blocked By field of the card's type with its live blockers (present, not trashed or archived), in field order.
export function blockedByGroups(
  item: Item,
  type: ItemTypeDef,
  items: ReadonlyMap<string, Item>,
): { field: CustomFieldDef; cards: Item[] }[] {
  const out: { field: CustomFieldDef; cards: Item[] }[] = [];
  for (const field of blocksFieldsOf(type)) {
    const cards: Item[] = [];
    for (const id of linkedCardIds(item, field)) {
      const card = id === item.id ? undefined : linkedCard(items, id);
      if (card && !isTrashed(card) && !isArchived(card) && !cards.includes(card)) cards.push(card);
    }
    if (cards.length) out.push({ field, cards });
  }
  return out;
}

export function BlockedBySections({
  item,
  type,
  onOpen,
}: {
  item: Item;
  type: ItemTypeDef;
  onOpen: (itemId: string) => void;
}) {
  const plan = usePlan();
  if (!plan) return null;
  const groups = blockedByGroups(item, type, plan.items);
  if (!groups.length) return null;
  const isDone = donePhase(plan.statusPhases);
  const doneCard = (c: Item) => isDone(namedStatus(c, plan.statusNames));
  // What each clashing open blocker's row says, by its id.
  const clashes = new Map(
    clashesOf(item, planBlocking(plan), doneCard).map((c) => [
      c.blocker.id,
      clashText(c.days, c.blocker, plan.types),
    ]),
  );
  return (
    <>
      {groups.map((g) => (
        <BlockedByGroup
          key={g.field.id}
          label={g.field.label}
          cards={g.cards}
          clashes={clashes}
          isDone={doneCard}
          types={plan.types}
          statusNames={plan.statusNames}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

function BlockedByGroup({
  label,
  cards,
  clashes,
  isDone,
  types,
  statusNames,
  onOpen,
}: {
  label: string;
  cards: readonly Item[];
  clashes: ReadonlyMap<string, string>;
  isDone: (card: Item) => boolean;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  onOpen: (itemId: string) => void;
}) {
  const headingId = useId();
  const open = cards.filter((c) => !isDone(c)).length;
  return (
    <section aria-labelledby={headingId} data-blocked-by="" className="mb-8">
      <h3
        id={headingId}
        className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
      >
        {label}
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {cards.length}
        </span>
        <span className={`text-[12px] font-medium ${open ? 'text-red-600 dark:text-red-400' : ''}`}>
          {open ? (
            `${open} open`
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400">All done</span>
          )}
        </span>
      </h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/40">
        {cards.map((card) => {
          const type = typeIn(types, card.type);
          const status = namedStatus(card, statusNames);
          const statusName = status ? (statusNames.get(status) ?? status) : 'No status';
          const done = isDone(card);
          const title = itemTitle(card) || 'Untitled';
          const clash = clashes.get(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                aria-label={`Open ${cardRefIn(types)(card)} ${title}, ${statusName}${done ? ', done' : ''}${clash ? `. ${clash}` : ''}`}
                onClick={() => onOpen(card.id)}
                className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 pointer-coarse:py-3 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
              >
                <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
                  <PlanTypeGlyph glyph={type.glyph} size={14} />
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                  {cardRefIn(types)(card)}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] font-medium ${done ? 'text-slate-500 line-through decoration-slate-300 dark:text-slate-400 dark:decoration-slate-600' : 'text-slate-800 dark:text-slate-100'}`}
                >
                  {title}
                </span>
                {done ? (
                  <span
                    className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    data-blocker-done=""
                  >
                    <CheckIcon size={13} />
                  </span>
                ) : null}
                <span
                  className={`${CHIP} max-w-[9rem] truncate bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700`}
                >
                  {statusName}
                </span>
                <span className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 motion-reduce:transition-none dark:text-slate-600 dark:group-hover:text-slate-300">
                  <ChevronRightIcon size={12} />
                </span>
              </button>
              {clash ? (
                <p
                  aria-hidden
                  data-blocker-clash=""
                  className="-mt-1 flex items-center gap-1.5 px-3 pb-2 pl-[2.6rem] text-[12px] font-medium text-amber-700 dark:text-amber-400"
                >
                  <ClashGlyph />
                  {clash}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
