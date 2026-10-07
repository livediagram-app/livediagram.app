'use client';

// The type editor's Statuses (docs/specs/026-plan/item-types.md "Editing a type"): every status this tab's boards
// name, each a chip pressed while the type uses it. A status pressed off is one a card of this type can never move
// into (a new card is still made in any column). Stored as what the type leaves out, so a status added later is open
// to every type. All may be turned off: such a card stays in the status it is made in. A type turns off at most
// ITEM_TYPE_EXCLUDED_STATUSES_MAX: at the cap a status still on cannot be turned off, and a note says why.
import { ITEM_TYPE_EXCLUDED_STATUSES_MAX } from '@livediagram/items';
import { CheckIcon } from '@livediagram/ui';

export function ItemTypeStatuses({
  statuses,
  excluded,
  onChange,
}: {
  // The statuses the boards name, in board order: id and name.
  statuses: readonly { status: string; name: string }[];
  excluded: readonly string[];
  onChange: (excluded: string[]) => void;
}) {
  if (statuses.length === 0)
    return (
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        No boards on this tab have columns yet, so there are no statuses to choose from.
      </p>
    );
  const used = statuses.filter((s) => !excluded.includes(s.status));
  const none = used.length === 0;
  const full = excluded.length >= ITEM_TYPE_EXCLUDED_STATUSES_MAX;
  return (
    <div>
      <p className="mb-2 text-[12px] text-slate-500 dark:text-slate-400">
        The statuses cards of this type can move into. A new card is made in whatever column it is
        added to; it can never be moved into one turned off. New statuses are on for every type.
      </p>
      <div role="group" aria-label="Statuses" className="flex flex-wrap gap-1.5">
        {statuses.map((s) => {
          const on = !excluded.includes(s.status);
          // At the cap a status still on stays on; one already off can always come back on.
          const locked = on && full;
          return (
            <button
              key={s.status}
              type="button"
              aria-pressed={on}
              disabled={locked}
              className={`inline-flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-60 gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                on
                  ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100'
                  : 'border-slate-200 text-slate-500 line-through decoration-slate-400 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
              }`}
              onClick={() =>
                onChange(on ? [...excluded, s.status] : excluded.filter((x) => x !== s.status))
              }
            >
              {on ? <CheckIcon size={12} /> : null}
              {s.name}
            </button>
          );
        })}
      </div>
      {full ? (
        <p role="note" className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
          A type can turn off at most {ITEM_TYPE_EXCLUDED_STATUSES_MAX} statuses. Turn one back on
          to turn off another.
        </p>
      ) : null}
      {none ? (
        <p role="note" className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
          With every status off, a card of this type stays in the status it is made in and can never
          be moved to another.
        </p>
      ) : null}
    </div>
  );
}
