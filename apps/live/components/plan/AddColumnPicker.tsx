'use client';

// The column picker (docs/specs/026-plan/plan-board.md "The column picker"), hung from a column's + Add Column
// After. One field names the column: when the document has statuses this board lacks, it is a combobox over them
// (Existing Statuses, ExistingStatusList), narrowing them as it is typed, the arrows moving through them and Enter
// adding the highlighted one; with none highlighted, Enter (or Add Column) adds the typed name, which uses the
// existing status of that name rather than a near-duplicate, and says so. Without any, it is the plain field.
import { useId, useState } from 'react';
import { Button, PlusIcon, TextInput } from '@livediagram/ui';
import type { MissingStatus, PlanBoardSetup } from '@livediagram/items';
import { COLUMN_NAME_MAX } from './board-setup-edits';
import { matchStatus, statusKey, type StatusPick } from './column-status-picks';
import { ExistingStatusList, HEADING, optionId } from './ExistingStatusList';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const pickOf = (s: MissingStatus): StatusPick => ({ status: s.status, name: s.name });

// The rows a typed text narrows to: those whose name holds it (as names compare), every row while it is blank.
export function narrowStatuses(
  statuses: readonly MissingStatus[],
  text: string,
): readonly MissingStatus[] {
  const key = statusKey(text);
  return key ? statuses.filter((s) => statusKey(s.name).includes(key)) : statuses;
}

export function AddColumnPicker({
  setup,
  statusNames,
  existing,
  autoFocus = false,
  onPick,
  onPickAll,
  onName,
}: {
  setup: Pick<PlanBoardSetup, 'columns'>;
  // The document's statuses (pickableStatuses), for what a typed name matches.
  statusNames: ReadonlyMap<string, string>;
  // The ones this board lacks, with their counts (missingBoardStatuses).
  existing: readonly MissingStatus[];
  autoFocus?: boolean;
  onPick: (pick: StatusPick) => void;
  onPickAll: (picks: StatusPick[]) => void;
  // A new status's name (a name matching an existing status arrives as a pick instead).
  onName: (name: string) => void;
}) {
  const id = useId();
  const listId = `${id}-statuses`;
  const [name, setName] = useState('');
  const [active, setActive] = useState(-1);
  const match = matchStatus(name, setup, statusNames);
  const shown = narrowStatuses(existing, name);
  const combo = existing.length > 0;
  const highlighted = active >= 0 ? shown[active] : undefined;
  // The typed name: the existing status of that name, or a new one; nothing for a name the board already has.
  const addTyped = () => {
    if (!name.trim() || match.kind === 'on-board') return;
    if (match.kind === 'existing') onPick(match.pick);
    else onName(name.trim());
    setName('');
  };
  const note =
    match.kind === 'existing'
      ? { text: `Uses the existing ${match.pick.name} status`, tone: 'muted' }
      : match.kind === 'on-board'
        ? { text: `This board already has ${match.name}`, tone: 'error' }
        : null;
  return (
    <div className="flex w-full flex-col gap-3 text-left" onPointerDown={stop} onKeyDown={stop}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className={HEADING}>
          {combo ? 'Add a Column' : 'Name a New Status'}
        </label>
        <div className="flex w-full gap-2">
          <TextInput
            compact
            id={`${id}-name`}
            aria-label="New column name"
            placeholder={combo ? 'Find or name a status' : 'In Review'}
            maxLength={COLUMN_NAME_MAX}
            value={name}
            autoFocus={autoFocus}
            autoComplete="off"
            className="h-9 min-w-0 flex-1 text-[13px]"
            {...(combo
              ? {
                  role: 'combobox',
                  'aria-expanded': shown.length > 0,
                  'aria-controls': listId,
                  'aria-autocomplete': 'list' as const,
                  ...(highlighted ? { 'aria-activedescendant': optionId(listId, active) } : {}),
                }
              : {})}
            aria-describedby={note ? `${id}-match` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              if (combo && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                const last = shown.length - 1;
                if (e.key === 'ArrowDown') setActive((a) => (a >= last ? last : a + 1));
                else setActive((a) => (a <= 0 ? -1 : a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlighted) onPick(pickOf(highlighted));
                else addTyped();
              }
            }}
          />
          <Button
            disabled={!name.trim() || match.kind === 'on-board'}
            onClick={addTyped}
            className="h-9 shrink-0 gap-1 px-3 text-[13px] font-semibold"
          >
            <PlusIcon size={14} />
            Add Column
          </Button>
        </div>
        {note ? (
          <p
            id={`${id}-match`}
            role="status"
            className={`text-[12px] ${
              note.tone === 'error'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {note.text}
          </p>
        ) : null}
      </div>
      {combo ? (
        <>
          <div aria-hidden className="h-px bg-slate-100 dark:bg-slate-800" />
          <ExistingStatusList
            listId={listId}
            statuses={shown}
            total={existing.length}
            active={active}
            query={name}
            onActive={setActive}
            onPick={(s) => onPick(pickOf(s))}
            onPickAll={
              existing.length >= 2 && !statusKey(name)
                ? () => onPickAll(existing.map(pickOf))
                : undefined
            }
          />
        </>
      ) : null}
    </div>
  );
}
