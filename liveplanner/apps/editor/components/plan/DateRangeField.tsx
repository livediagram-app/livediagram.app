'use client';

// A Date Range field in the card panel (docs/specs/026-plan/item-types.md "Date Range"): From and To, two date boxes,
// or two date-and-time boxes when the field includes times. Setting one end with none set fills both; moving one end
// past the other moves the other with it, so the range is always whole and in order. Clearing either end clears the
// range.
import { DateInput } from '@liveplanner/ui';
import {
  rangeWithEnd,
  readRange,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@liveplanner/items';
import { DateTimeInput } from './DateTimeInput';

export function DateRangeField({
  id,
  field,
  value,
  disabled,
  onSave,
}: {
  id: string;
  field: Pick<CustomFieldDef, 'label' | 'withTime'>;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: (value: ItemFieldValue | undefined) => void;
}) {
  const range = readRange(value);
  // A stored range of the other shape (days on a timed field, or the reverse) shows empty until the next edit.
  const timed = field.withTime === true;
  const r = range && range.timed === timed ? range : undefined;
  const set = (role: 'start' | 'due', end: string | undefined) => {
    if (end === undefined) onSave(undefined);
    else onSave(rangeWithEnd(r ? [r.start, r.end] : undefined, role, end));
  };
  const box = (role: 'start' | 'due', word: string) => {
    const end = role === 'start' ? r?.start : r?.end;
    const label = `${field.label}: ${word}`;
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{word}</span>
        {timed ? (
          <DateTimeInput
            id={role === 'start' ? id : `${id}-to`}
            label={label}
            value={end}
            disabled={disabled}
            onCommit={(v) => set(role, v)}
          />
        ) : (
          <DateInput
            id={role === 'start' ? id : `${id}-to`}
            aria-label={label}
            compact
            disabled={disabled}
            value={end}
            onCommit={(v) => set(role, v)}
          />
        )}
      </label>
    );
  };
  return (
    // One end a row, its word above it: the panel's column is too narrow for two date boxes side by side, and a
    // date-and-time box needs the column's whole width.
    <div role="group" aria-label={field.label} className="flex flex-col gap-1 [&_input]:min-w-0">
      {box('start', 'From')}
      {box('due', 'To')}
    </div>
  );
}
