'use client';

// Card Search (docs/specs/026-plan/plan-views.md "Card Search"): filters in a bar along the top, each a chip
// ("Card Type: Project", with a cross), and the cards matching them all listed below, a row each that opens its
// card. Add Filter picks a field, then a value: only the fields the matching cards' types offer and the values some
// matching card has (each with its count), so no pick ever leaves nothing. The filters are the view's own, saved with
// it, so everyone sees the same search; someone who may only view sees them but cannot change them.
import { useMemo } from 'react';
import {
  CARD_SEARCH_FILTERS_MAX,
  itemAssignee,
  itemTitle,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
  typeIn,
  type CardSearchFilter,
  type SwimlaneBy,
  namedStatus,
} from '@livediagram/items';
import { CloseIcon } from '@livediagram/ui';
import { AddFilterPicker } from '../AddFilterPicker';
import { track } from '@/lib/telemetry';
import { PersonDisc } from '../PersonDisc';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '../plan-palette';
import { ViewFrame, openProps, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

const NO_FILTERS: readonly CardSearchFilter[] = [];
const NO_STATUSES = new Map<string, string>();

// A field in the Add Filter menu, as one value: its grouping and field.
const fieldKey = (f: { by: SwimlaneBy; field?: string | undefined }) =>
  f.by === 'field' ? `field:${f.field}` : f.by;

export function CardSearchView({
  plan,
  items,
  palette,
  fontFamily,
  elementId,
  settings,
}: PlanViewProps) {
  const filters = settings.filters ?? NO_FILTERS;
  const types = plan?.types;
  const statusNames = plan?.statusNames ?? NO_STATUSES;
  const canEdit = !!plan?.canEdit && !!plan?.planInput;
  const matching = useMemo(
    () => searchCards(items.values(), filters, types, statusNames),
    [items, filters, types, statusNames],
  );
  const fields = useMemo(() => searchFields(matching, filters, types), [matching, filters, types]);
  const save = (next: CardSearchFilter[]) => {
    if (!plan) return;
    const { filters: _drop, ...rest } = settings;
    plan.updateView(elementId, next.length ? { ...rest, filters: next } : rest);
  };
  const total = matching.length;
  return (
    <ViewFrame
      title="Card Search"
      count={total}
      countLabel={`${total} ${total === 1 ? 'card' : 'cards'}`}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, true)}
      empty=""
    >
      <div className="absolute inset-0 flex flex-col">
        <div
          role="toolbar"
          aria-label="Filters"
          className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2"
          style={{ borderColor: palette.border }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {filters.map((f, i) => {
            const label = searchFilterLabel(f, items.values(), types, statusNames);
            return (
              <span
                key={`${fieldKey(f)}:${f.key}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-[12px] text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-500/30"
              >
                <span className="font-medium">{label.field}:</span>
                <span>{label.value}</span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Remove ${label.field}: ${label.value}`}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-100 dark:hover:bg-brand-500/20"
                    onClick={() => {
                      save(filters.filter((_, j) => j !== i));
                      track('Plan', 'Removed', 'SearchFilter');
                    }}
                  >
                    <CloseIcon size={10} />
                  </button>
                ) : null}
              </span>
            );
          })}
          {canEdit && filters.length < CARD_SEARCH_FILTERS_MAX && fields.length > 0 ? (
            <AddFilterPicker
              fields={fields.map((f) => ({ id: fieldKey(f), label: f.label }))}
              valuesOf={(id) => {
                const f = fields.find((x) => fieldKey(x) === id);
                return f ? searchValues(matching, f, types, statusNames, items.values()) : [];
              }}
              onPick={(id, key) => {
                const f = fields.find((x) => fieldKey(x) === id);
                if (!f) return;
                save([...filters, { by: f.by, ...(f.field ? { field: f.field } : {}), key }]);
                track('Plan', 'Added', 'SearchFilter');
              }}
            />
          ) : null}
          {filters.length === 0 && !canEdit ? (
            <span className="text-[12px]" style={{ color: palette.muted }}>
              Every card
            </span>
          ) : null}
          {canEdit && filters.length > 0 ? (
            <button
              type="button"
              className="ml-auto cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: palette.muted }}
              onClick={() => {
                save([]);
              }}
            >
              Clear All
            </button>
          ) : null}
        </div>
        {total === 0 ? (
          <p className="px-3 py-4 text-[13px]" style={{ color: palette.muted }}>
            {filters.length
              ? 'No cards match these filters.'
              : 'No cards yet. Add cards to a board.'}
          </p>
        ) : (
          <ul
            className="min-h-0 flex-1 divide-y overflow-y-auto"
            style={{ borderColor: palette.border }}
          >
            {matching.map((card) => {
              const type = typeIn(types ?? [], card.type);
              const status = namedStatus(card, statusNames);
              const assignee = itemAssignee(card);
              return (
                <li key={card.id} style={{ borderColor: palette.border }}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition hover:bg-black/[0.03] dark:hover:bg-white/5"
                    {...openProps(plan, card.id)}
                  >
                    <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
                      <PlanTypeGlyph glyph={type.glyph} size={14} />
                    </span>
                    <span
                      className="shrink-0 text-[12px] tabular-nums"
                      style={{ color: palette.muted }}
                    >
                      #{card.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate" style={{ color: palette.text }}>
                      {itemTitle(card)}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: palette.muted }}>
                      {status ? statusNames.get(status) : 'No status'}
                    </span>
                    {assignee ? <PersonDisc person={assignee} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ViewFrame>
  );
}
