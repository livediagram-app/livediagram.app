'use client';

// A Duration field's box in the card panel (docs/specs/026-plan/item-types.md "Duration"): typed as "2h 30m", "90m",
// "1.5h" or "2:30", saved on Enter or leaving the box and shown back as it reads; Escape puts it back, emptying it
// clears the field, and text that is no duration puts the box back and says so.
import { useState } from 'react';
import { TextInput } from '@liveplanner/ui';
import { DURATION_HINT, durationText, parseDuration } from '@liveplanner/items';

export function DurationInput({
  id,
  label,
  minutes,
  disabled,
  onSave,
  placeholder = '2h 30m',
}: {
  id: string;
  label: string;
  minutes: number | undefined;
  disabled: boolean;
  onSave: (minutes: number | undefined) => void;
  placeholder?: string;
}) {
  const shown = minutes === undefined ? '' : durationText(minutes);
  const [problem, setProblem] = useState<string | null>(null);
  const commit = (input: HTMLInputElement) => {
    const raw = input.value.trim();
    if (raw === '') {
      setProblem(null);
      if (minutes !== undefined) onSave(undefined);
      return;
    }
    const next = parseDuration(raw);
    if (next === undefined) {
      input.value = shown;
      setProblem(DURATION_HINT);
      return;
    }
    setProblem(null);
    input.value = durationText(next);
    if (next !== minutes) onSave(next);
  };
  return (
    <div className="flex flex-col gap-1">
      <TextInput
        id={id}
        inputMode="text"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        compact
        className="w-28 tabular-nums"
        defaultValue={shown}
        key={shown}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(e.currentTarget);
          } else if (e.key === 'Escape') {
            e.currentTarget.value = shown;
            setProblem(null);
            e.stopPropagation();
          }
        }}
      />
      {problem ? (
        <span
          id={`${id}-problem`}
          role="alert"
          className="text-[12px] text-red-700 dark:text-red-300"
        >
          {`${label}: ${problem}.`}
        </span>
      ) : null}
    </div>
  );
}
