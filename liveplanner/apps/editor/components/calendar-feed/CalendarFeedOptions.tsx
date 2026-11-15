'use client';

// Subscribe to Calendar's What It Shows (docs/specs/026-plan/calendar-feed.md "The options"): the Board picker (All
// Boards or one board by its title, its tab's name after it when two boards share a title) and the Only My Cards and
// Include Done Cards switches. The dialog decides what a change does: the choice to make the link with, or a save that
// keeps the link.
import { useId } from 'react';
import type { CalendarFeedBoard, CalendarFeedOptions } from '@liveplanner/api-schema';
import { Select, SettingsToggleRow } from '@liveplanner/ui';

// The Board picker's value for every board (a board id is never empty).
const ALL_BOARDS = '';

/** Each board's label: its title, with its tab's name after it when another board shares the title. */
export function boardLabels(boards: readonly CalendarFeedBoard[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const b of boards) counts.set(b.title, (counts.get(b.title) ?? 0) + 1);
  return new Map(
    boards.map((b) => [
      b.id,
      (counts.get(b.title) ?? 0) > 1 ? `${b.title} (${b.tabName})` : b.title || b.tabName,
    ]),
  );
}

export function CalendarFeedOptionsSection({
  boards,
  options,
  disabled = false,
  onChange,
}: {
  boards: readonly CalendarFeedBoard[];
  options: CalendarFeedOptions;
  disabled?: boolean;
  onChange: (next: CalendarFeedOptions) => void;
}) {
  const boardId = useId();
  const labels = boardLabels(boards);
  // A board that went since the feed was made: shown for what it is, until another is picked.
  const gone = options.boardId !== null && !labels.has(options.boardId);
  return (
    <section aria-labelledby={`${boardId}-heading`} className="flex flex-col gap-2">
      <h3
        id={`${boardId}-heading`}
        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        What It Shows
      </h3>
      <div className="flex items-center justify-between gap-3 px-2">
        <label htmlFor={boardId} className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Board
        </label>
        <Select
          id={boardId}
          value={options.boardId ?? ALL_BOARDS}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...options, boardId: e.target.value === ALL_BOARDS ? null : e.target.value })
          }
          className="min-w-0 max-w-[60%]"
          selectClassName="w-full truncate"
        >
          <option value={ALL_BOARDS}>All Boards</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {labels.get(b.id)}
            </option>
          ))}
          {gone ? <option value={options.boardId!}>Removed Board</option> : null}
        </Select>
      </div>
      <SettingsToggleRow
        label="Only My Cards"
        hint="Just the cards that name you in a person field, as Assigned to You does."
        checked={options.mine}
        disabled={disabled}
        onToggle={() => onChange({ ...options, mine: !options.mine })}
      />
      <SettingsToggleRow
        label="Include Done Cards"
        hint="Cards in a done column too. Off, finished work drops out of your calendar."
        checked={options.includeDone}
        disabled={disabled}
        onToggle={() => onChange({ ...options, includeDone: !options.includeDone })}
      />
    </section>
  );
}
