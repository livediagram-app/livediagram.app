'use client';

// The type editor's States (docs/specs/026-plan/item-types.md "Editing a type"): every status the document's boards
// name, grouped under each board's title (No Board last for one only cards are in), as grids of checkbox rows, ticked while the type uses it, with a count and Select All and Deselect All. A
// status unticked is one a card of this type can never move into (a new card is still made in any column). Stored as
// what the type leaves out, so a status added later is open to every type. All may be unticked: such a card stays in
// the status it is made in. A type leaves out at most ITEM_TYPE_EXCLUDED_STATUSES_MAX: at the cap a status still
// ticked cannot be unticked (Deselect All stops there too), and a note says why.
import { useId } from 'react';
import { ITEM_TYPE_EXCLUDED_STATUSES_MAX, builtInDefaultStatus } from '@livediagram/items';
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

// The statuses grouped by the boards that name them (docs/specs/026-plan/item-types.md "Editing a type"): a group per
// board, under its title as it is now, holding its listed statuses in column order (a status on two boards shows in
// both), then No Board for any listed status no board names. Without boards, one untitled group of every status.
export function statusGroups(
  statuses: readonly Status[],
  boards: readonly { title: string; statuses: readonly string[] }[] | undefined,
): { title: string | null; statuses: Status[] }[] {
  if (!boards) return [{ title: null, statuses: [...statuses] }];
  const byId = new Map(statuses.map((s) => [s.status, s]));
  const onABoard = new Set<string>();
  const groups: { title: string | null; statuses: Status[] }[] = [];
  for (const b of boards) {
    const listed = b.statuses.flatMap((id) => {
      const s = byId.get(id);
      return s ? [s] : [];
    });
    for (const s of listed) onABoard.add(s.status);
    if (listed.length) groups.push({ title: b.title || 'Untitled Board', statuses: listed });
  }
  const loose = statuses.filter((s) => !onABoard.has(s.status));
  if (loose.length) groups.push({ title: 'No Board', statuses: loose });
  return groups;
}

export function ItemTypeStatuses({
  statuses,
  excluded,
  onChange,
  defaultStatus = '',
  onDefaultStatus,
  typeId,
  boards,
}: {
  // The statuses the boards name, in board order: id and name.
  statuses: readonly Status[];
  excluded: readonly string[];
  onChange: (excluded: string[]) => void;
  // The Default State ('' for none), and its setter; without the setter the menu is left out.
  defaultStatus?: string;
  onDefaultStatus?: (status: string) => void;
  // The type's id: a built-in type's named Default State shows in place of None.
  typeId?: string;
  // Each board's title and the statuses it names: the statuses are grouped under them (statusGroups).
  boards?: readonly { title: string; statuses: readonly string[] }[];
}) {
  const defaultId = useId();
  if (statuses.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No boards on this tab have columns yet, so there are no states to choose from.
      </p>
    );
  const onCount = statuses.filter((s) => !excluded.includes(s.status)).length;
  // A built-in type's Default State by name, as this document has it (none chosen falls back to it).
  const builtInId = typeId
    ? builtInDefaultStatus(
        { id: typeId, excludedStatuses: excluded },
        statuses.map((s) => [s.status, s.name] as const),
      )
    : undefined;
  const builtIn = statuses.find((s) => s.status === builtInId);
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
          {onCount} of {statuses.length} {statuses.length === 1 ? 'state' : 'states'} on
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
      <div className="flex flex-col gap-3">
        {statusGroups(statuses, boards).map((g, gi) => {
          const groupOn = g.statuses.filter((x) => !excluded.includes(x.status)).length;
          return (
            <section key={`${gi}:${g.title ?? ''}`} aria-label={g.title ?? 'States'}>
              {g.title !== null ? (
                <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="min-w-0 truncate">{g.title}</span>
                  <span className="font-medium normal-case tracking-normal tabular-nums">
                    {groupOn} of {g.statuses.length} {g.statuses.length === 1 ? 'state' : 'states'}{' '}
                    on
                  </span>
                </h4>
              ) : null}
              <div
                role="group"
                aria-label={g.title ? `${g.title} states` : 'States'}
                className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3"
              >
                {g.statuses.map((x) => (
                  <StatusRow
                    key={x.status}
                    status={x}
                    on={!excluded.includes(x.status)}
                    full={full}
                    onToggle={(on) =>
                      onChange(
                        on ? [...excluded, x.status] : excluded.filter((y) => y !== x.status),
                      )
                    }
                  />
                ))}
              </div>
            </section>
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
            // Each state once, by its own name. A built-in type with no default chosen shows its built-in one picked
            // (no None: it falls back to that anyway); what is picked is saved as picked.
            value={
              defaultStatus && !excluded.includes(defaultStatus)
                ? defaultStatus
                : (builtIn?.status ?? '')
            }
            onChange={(e) => onDefaultStatus(e.target.value)}
          >
            {builtIn ? null : <option value="">None</option>}
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

// One status as a checkbox row; at the cap a status still on stays on, one already off can always come back on.
function StatusRow({
  status,
  on,
  full,
  onToggle,
}: {
  status: Status;
  on: boolean;
  full: boolean;
  // Called with whether it was on (so it turns off).
  onToggle: (wasOn: boolean) => void;
}) {
  const locked = on && full;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={locked}
      className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        on
          ? 'border-brand-300 bg-brand-50 text-slate-900 hover:border-brand-400 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-slate-50'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
      }`}
      onClick={() => onToggle(on)}
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
      <span className="min-w-0 truncate">{status.name}</span>
    </button>
  );
}
