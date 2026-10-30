'use client';

// The label menu under a card's Labels field (docs/specs/026-plan/plan-board.md "Working on a board"): the plan's
// labels as the chips the field draws, each with a badge of how many cards carry it, then a dashed Create chip when
// the text names no label. A listbox the field drives (aria-activedescendant): a press here never takes focus from
// the field, so typing carries on after a pick.
import type { CSSProperties } from 'react';
import { ITEM_LABELS_MAX, type LabelUse } from '@liveplanner/items';
import { PlusIcon, Tooltip } from '@liveplanner/ui';
import { labelColour } from './label-colour';

// The chip's tint and ink (ChipField's: a 12% tint, inked 70% toward the page's ink), a deeper tint for its badge,
// and a ring in its own colour while highlighted.
const CHIP =
  'bg-[color-mix(in_srgb,var(--chip)_12%,transparent)] text-[color-mix(in_srgb,var(--chip)_70%,#0f172a)] dark:text-[color-mix(in_srgb,var(--chip)_70%,#ffffff)]';
const CHIP_ACTIVE =
  'bg-[color-mix(in_srgb,var(--chip)_20%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--chip)_55%,transparent)]';
const BADGE =
  'bg-[color-mix(in_srgb,var(--chip)_18%,transparent)] dark:bg-[color-mix(in_srgb,var(--chip)_28%,transparent)]';

const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

// The label with the typed text in bold, wherever it falls (case aside).
function Highlighted({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <strong className="font-bold">{label.slice(at, at + query.length)}</strong>
      {label.slice(at + query.length)}
    </>
  );
}

export function LabelMenu({
  listId,
  matches,
  query,
  creatable,
  active,
  full,
  planHasLabels,
  onHover,
  onChoose,
}: {
  listId: string;
  matches: readonly LabelUse[];
  // What is typed, without a leading #.
  query: string;
  creatable: boolean;
  active: number;
  // The card holds all the labels it may.
  full: boolean;
  planHasLabels: boolean;
  onHover: (index: number) => void;
  // An option by its index: a match, or Create (the index after the last match).
  onChoose: (index: number) => void;
}) {
  const note = full
    ? `A card holds up to ${ITEM_LABELS_MAX} labels. Remove one to add another.`
    : !planHasLabels && !query
      ? 'No labels yet. Type one to add it.'
      : matches.length || creatable
        ? null
        : query
          ? `“${query}” is on this card already.`
          : 'Every label on this plan is on this card.';
  return (
    <div
      // Pressing a chip never moves focus out of the field (which would add the typed text as it is).
      onPointerDown={(e) => e.preventDefault()}
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          Labels on this plan
        </span>
        {!full && matches.length ? (
          <span className="text-[10.5px] text-slate-400 max-sm:hidden [@media(hover:none)]:hidden">
            ↑↓ to choose · Enter to add
          </span>
        ) : null}
      </div>
      {note ? (
        <p className="px-0.5 pb-0.5 text-[12px] text-slate-500 dark:text-slate-400">{note}</p>
      ) : (
        <div
          id={listId}
          role="listbox"
          aria-label="Labels on this plan"
          className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto p-0.5"
        >
          {matches.map((u, i) => (
            <Tooltip key={u.label} label={`On ${cards(u.count)}`}>
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-label={`${u.label}, on ${cards(u.count)}`}
                onPointerMove={() => i !== active && onHover(i)}
                onClick={() => onChoose(i)}
                style={{ '--chip': labelColour(u.label) } as CSSProperties}
                className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1 text-[12px] font-medium transition max-sm:py-1 max-sm:text-[14px] ${CHIP} ${
                  i === active
                    ? CHIP_ACTIVE
                    : 'hover:bg-[color-mix(in_srgb,var(--chip)_18%,transparent)]'
                }`}
              >
                <span className="truncate">
                  <Highlighted label={u.label} query={query} />
                </span>
                <span
                  aria-hidden
                  className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[10.5px] font-semibold tabular-nums leading-[1.125rem] ${BADGE}`}
                >
                  {u.count}
                </span>
              </div>
            </Tooltip>
          ))}
          {creatable ? (
            <div
              id={`${listId}-${matches.length}`}
              role="option"
              aria-selected={active === matches.length}
              aria-label={`Create label ${query}`}
              onPointerMove={() => active !== matches.length && onHover(matches.length)}
              onClick={() => onChoose(matches.length)}
              className={`inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-[12px] font-medium transition max-sm:py-1 max-sm:text-[14px] ${
                active === matches.length
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <PlusIcon size={11} />
              <span className="truncate">Create “{query}”</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
