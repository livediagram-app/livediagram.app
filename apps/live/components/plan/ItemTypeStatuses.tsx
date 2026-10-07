'use client';

// The type editor's States (docs/specs/026-plan/item-types.md "Editing a type"): every status this tab's boards
// name, as a grid of checkbox rows, ticked while the type uses it, with a count and Select All and Deselect All. A
// status unticked is one a card of this type can never move into (a new card is still made in any column). Stored as
// what the type leaves out, so a status added later is open to every type. All may be unticked: such a card stays in
// the status it is made in. A type leaves out at most ITEM_TYPE_EXCLUDED_STATUSES_MAX: at the cap a status still
// ticked cannot be unticked (Deselect All stops there too), and a note says why.
import { useId } from 'react';
import { ITEM_TYPE_EXCLUDED_STATUSES_MAX } from '@livediagram/items';
import { Button, CheckIcon, Select } from '@livediagram/ui';

type Status = { status: string; name: string };

// Select All: every listed status back on; a left-out status no board lists any more stays left out.
export function selectAllStates(
  statuses: readonly Status[],
  excluded: readonly string[],
): string[] {
  const listed = new Set(statuses.map((s) => s.status));
  return excluded.filter((x) => !listed.has(x));
}

// Deselect All: every listed status off, in board order, as far as the cap allows.
export function deselectAllStates(
  statuses: readonly Status[],
  excluded: readonly string[],
): string[] {
  const next = [...excluded];
  for (const s of statuses) {
    if (next.length >= ITEM_TYPE_EXCLUDED_STATUSES_MAX) break;
    if (!next.includes(s.status)) next.push(s.status);
  }
  return next;
}

export function ItemTypeStatuses({
  statuses,
  excluded,
  onChange,
  defaultStatus = '',
  onDefaultStatus,
}: {
  // The statuses the boards name, in board order: id and name.
  statuses: readonly Status[];
  excluded: readonly string[];
  onChange: (excluded: string[]) => void;
  // The Default State ('' for none), and its setter; without the setter the menu is left out.
  defaultStatus?: string;
  onDefaultStatus?: (status: string) => void;
}) {
  const defaultId = useId();
  if (statuses.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No boards on this tab have columns yet, so there are no states to choose from.
      </p>
    );
  const onCount = statuses.filter((s) => !excluded.includes(s.status)).length;
  const full = excluded.length >= ITEM_TYPE_EXCLUDED_STATUSES_MAX;
  const allOn = onCount === statuses.length;
  const allOff =
    onCount === 0 || (full && deselectAllStates(statuses, excluded).length === excluded.length);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        The states cards of this type can move into. A new card is made in whatever column it is
        added to; it can never be moved into one turned off. New states are on for every type.
      </p>
      <div className="flex items-center gap-2">
        <span
          aria-live="polite"
          className="text-[12px] font-medium text-slate-600 dark:text-slate-300"
        >
          {onCount} of {statuses.length} on
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          disabled={allOn}
          onClick={() => onChange(selectAllStates(statuses, excluded))}
        >
          Select All
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={allOff}
          onClick={() => onChange(deselectAllStates(statuses, excluded))}
        >
          Deselect All
        </Button>
      </div>
      <div
        role="group"
        aria-label="States"
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3"
      >
        {statuses.map((s) => {
          const on = !excluded.includes(s.status);
          // At the cap a status still on stays on; one already off can always come back on.
          const locked = on && full;
          return (
            <button
              key={s.status}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={locked}
              className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                on
                  ? 'border-brand-300 bg-brand-50 text-slate-900 hover:border-brand-400 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-slate-50'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
              }`}
              onClick={() =>
                onChange(on ? [...excluded, s.status] : excluded.filter((x) => x !== s.status))
              }
            >
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                  on
                    ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-600 dark:bg-brand-600'
                    : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                }`}
              >
                {on ? <CheckIcon size={11} /> : null}
              </span>
              <span className="min-w-0 truncate">{s.name}</span>
            </button>
          );
        })}
      </div>
      {full ? (
        <p role="note" className="text-[12px] text-slate-500 dark:text-slate-400">
          A type can turn off at most {ITEM_TYPE_EXCLUDED_STATUSES_MAX} states. Turn one back on to
          turn off another.
        </p>
      ) : null}
      {onCount === 0 ? (
        <p role="note" className="text-[12px] text-slate-500 dark:text-slate-400">
          With every state off, a card of this type stays in the state it is made in and can never
          be moved to another.
        </p>
      ) : null}
      {onDefaultStatus ? (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-200 pt-3 dark:border-slate-700">
          <label
            htmlFor={defaultId}
            className="text-[12px] font-semibold text-slate-700 dark:text-slate-200"
          >
            Default State
          </label>
          <Select
            id={defaultId}
            className="w-full sm:w-64"
            selectClassName="text-[13px]"
            value={defaultStatus && !excluded.includes(defaultStatus) ? defaultStatus : ''}
            onChange={(e) => onDefaultStatus(e.target.value)}
          >
            <option value="">None</option>
            {statuses
              .filter((s) => !excluded.includes(s.status))
              .map((s) => (
                <option key={s.status} value={s.status}>
                  {s.name}
                </option>
              ))}
          </Select>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Cards made outside a board start here; a card added to a board takes that column&apos;s
            state.
          </p>
        </div>
      ) : null}
    </div>
  );
}
