'use client';

// The Cards panel (docs/specs/026-plan/items.md "Finding a card"): every live card in the document, of every card
// type (custom ones included), newest change first, searched by number, title, description or type name; **Not on
// a Board** narrows it to the cards no board in the document shows (no column holds the status, or every board
// naming it leaves the card's type out), so strays can be found and put
// somewhere, and the card type chips to the pressed types. Choosing one opens it. A popover above its button in
// Plan mode's bottom-right cluster, like Card Types and the Trash.
import { useMemo, useState } from 'react';
import {
  CARD_SEARCH_FILTERS_MAX,
  findCards,
  isOffBoard,
  isPriority,
  itemAssignee,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
  type CardSearchFilter,
  type SwimlaneBy,
  statusLabel,
  typeIn,
  itemTitle,
  type BoardStatusTypes,
  type CardFinderShow,
} from '@livediagram/items';
import { CloseIcon, CountBadge, Tooltip, TrashIcon } from '@livediagram/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { SearchInput } from '@/components/primitives/SearchInput';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';
import { AddFilterPicker } from './AddFilterPicker';
import { PersonDisc } from './PersonDisc';
import { PrioritySignal } from './plan-card-parts';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

// The most rows drawn at once; a search narrows the rest.
const CARD_FINDER_ROWS_MAX = 200;

const NO_STATUS_TYPES: BoardStatusTypes = new Map();

const filterKey = (f: { by: SwimlaneBy; field?: string | undefined }) =>
  f.by === 'field' ? `field:${f.field}` : f.by;

// A due date as the row reads it: "12 Oct".
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const SHOWS: { id: CardFinderShow; label: string }[] = [
  { id: 'all', label: 'All Cards' },
  { id: 'off-board', label: 'Not on a Board' },
];

export function CardFinderPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<CardFinderShow>('all');
  // The card types narrowed to: none is every type. The person's own, while the panel is open.
  const [types, setTypes] = useState<ReadonlySet<string>>(() => new Set());
  // Field filters (a state, an assignee, a priority...), the person's own as the types are.
  const [filters, setFilters] = useState<readonly CardSearchFilter[]>([]);
  // Focused on open with a mouse; on a phone the keyboard waits until the field is tapped.
  const [finePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches,
  );
  const boardStatuses = plan?.statusTypes ?? NO_STATUS_TYPES;
  const live = useMemo(
    () => findCards(plan?.items.values() ?? [], { query: '', show: 'all', boardStatuses }),
    [plan?.items, boardStatuses],
  );
  if (!plan) return null;
  const typeLabel = (id: string) => typeIn(plan.types, id).label;
  // The live cards of the pressed types (all when none is pressed): what the counts and the list read.
  const ofTypes = types.size > 0 ? live.filter((it) => types.has(it.type)) : live;
  const counts = {
    all: ofTypes.length,
    'off-board': ofTypes.filter((it) => isOffBoard(it, boardStatuses)).length,
  };
  const searched = findCards(ofTypes, { query, show, boardStatuses, typeLabel });
  // The field filters (docs/specs/026-plan/items.md "Finding a card"), as Card Search's: each must match.
  const found = filters.length
    ? searchCards(searched, filters, plan.types, plan.statusNames)
    : searched;
  const filterFields = searchFields(found, filters, plan.types).filter((f) => f.by !== 'type');
  const toggleType = (id: string) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <MovablePanel
      title="Cards"
      helpArticle="planCards"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-[44rem]"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-[calc(100vw-2rem)] sm:w-[44rem]"
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2.5 px-3 pb-3">
        <div className="flex">
          <SearchInput
            autoFocus={finePointer}
            ariaLabel="Search cards"
            placeholder="Search by #, title, description or type"
            value={query}
            onChange={setQuery}
            onKeyDown={(e) => e.stopPropagation()}
            clearAriaLabel="Clear the card search"
            clearDescription="Clear the card search query."
          />
        </div>
        <div
          role="radiogroup"
          aria-label="Which cards"
          className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
        >
          {SHOWS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={show === s.id}
              onClick={() => setShow(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition ${
                show === s.id
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {s.label}
              <CountBadge
                size="md"
                background={s.id === 'off-board' && counts[s.id] ? '#d9770626' : '#64748b26'}
                color={s.id === 'off-board' && counts[s.id] ? '#b45309' : '#64748b'}
              >
                {counts[s.id]}
              </CountBadge>
            </button>
          ))}
        </div>
        {/* Card types: a chip per catalogue type, pressed to narrow the list to it (several may be). */}
        <div className="flex items-start gap-1">
          <div
            role="group"
            aria-label="Card types"
            className="flex max-h-[4.25rem] min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto"
          >
            {plan.types.map((t) => {
              const on = types.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleType(t.id)}
                  className={`inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition ${
                    on
                      ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={ACCENT_TEXT} style={accentVars(t.color)}>
                    <PlanTypeGlyph glyph={t.glyph} size={12} />
                  </span>
                  <span className="text-optical-centre">{t.label}</span>
                </button>
              );
            })}
          </div>
          {types.size > 0 ? (
            <button
              type="button"
              onClick={() => setTypes(new Set())}
              className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <CloseIcon size={10} />
              <span className="text-optical-centre">Clear</span>
            </button>
          ) : null}
        </div>
        {/* Field filters: chips, each with a cross, and Add Filter (a field, then a value with its count). */}
        <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => {
            const label = searchFilterLabel(f, plan.items.values(), plan.types, plan.statusNames);
            return (
              <span
                key={`${f.by}:${f.field ?? ''}:${f.key}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-[12px] text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-500/30"
              >
                <span className="font-medium">{label.field}:</span>
                <span>{label.value}</span>
                <button
                  type="button"
                  aria-label={`Remove ${label.field}: ${label.value}`}
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-100 dark:hover:bg-brand-500/20"
                  onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                >
                  <CloseIcon size={10} />
                </button>
              </span>
            );
          })}
          {filters.length < CARD_SEARCH_FILTERS_MAX && filterFields.length > 0 ? (
            <AddFilterPicker
              fields={filterFields.map((f) => ({ id: filterKey(f), label: f.label }))}
              valuesOf={(id) => {
                const f = filterFields.find((x) => filterKey(x) === id);
                return f ? searchValues(found, f, plan.types, plan.statusNames) : [];
              }}
              onPick={(id, key) => {
                const f = filterFields.find((x) => filterKey(x) === id);
                if (f)
                  setFilters([
                    ...filters,
                    { by: f.by, ...(f.field ? { field: f.field } : {}), key },
                  ]);
              }}
            />
          ) : null}
          {filters.length > 0 ? (
            <button
              type="button"
              className="ml-auto cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setFilters([])}
            >
              Clear Filters
            </button>
          ) : null}
        </div>
        {found.length === 0 ? (
          <p className="flex h-[min(60vh,32rem)] items-center justify-center px-2 text-center text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            {live.length === 0
              ? 'No cards yet. Add one from a board, or drag one in from the palette.'
              : query.trim()
                ? 'No cards match that search.'
                : filters.length > 0
                  ? 'No cards match these filters.'
                  : types.size > 0 && ofTypes.length === 0
                    ? 'No cards of those types yet.'
                    : 'Every card is on a board here.'}
          </p>
        ) : (
          <ul
            aria-label="Cards"
            // The same height however many cards: the panel never shrinks as a search narrows it.
            className="flex h-[min(60vh,32rem)] flex-col gap-0.5 overflow-y-auto"
          >
            {found.slice(0, CARD_FINDER_ROWS_MAX).map((it) => {
              const type = typeIn(plan.types, it.type);
              const status = typeof it.fields['status'] === 'string' ? it.fields['status'] : null;
              return (
                <li
                  key={it.id}
                  // The whole row is the card: its hover and focus wash takes in the trash button too.
                  className="group/row flex items-center gap-1 rounded-lg pr-1 transition hover:bg-slate-100 focus-within:bg-slate-100 dark:hover:bg-slate-800 dark:focus-within:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPopoverClose();
                      plan.openItem(it.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
                      style={accentVars(type.color)}
                    >
                      <PlanTypeGlyph glyph={type.glyph} size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                        {itemTitle(it) || 'Untitled'}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {type.label} #{it.key}
                      </span>
                    </span>
                    {/* The wide panel's extra columns: where it stands, how urgent, when due, and whose. */}
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      {isPriority(it.fields['priority']) ? (
                        <PrioritySignal priority={it.fields['priority']} label />
                      ) : null}
                      {typeof it.fields['due'] === 'string' ? (
                        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          Due {shortDate(it.fields['due'])}
                        </span>
                      ) : null}
                      <span className="max-w-[9rem] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {status ? statusLabel(status, plan.statusNames) : 'No status'}
                      </span>
                      {itemAssignee(it) ? (
                        <PersonDisc person={itemAssignee(it)!} />
                      ) : (
                        <span aria-hidden className="h-5 w-5" />
                      )}
                    </span>
                  </button>
                  {plan.canEdit ? (
                    <Tooltip label="Move to Trash">
                      <button
                        type="button"
                        aria-label={`Move #${it.key} to the Trash`}
                        onClick={() => {
                          plan.trashItem(it.id);
                          plan.announce(`#${it.key} moved to the Trash`);
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/row:opacity-100"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </Tooltip>
                  ) : null}
                </li>
              );
            })}
            {found.length > CARD_FINDER_ROWS_MAX ? (
              <li className="px-2 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                Showing {CARD_FINDER_ROWS_MAX} of {found.length}. Search to narrow them down.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}
