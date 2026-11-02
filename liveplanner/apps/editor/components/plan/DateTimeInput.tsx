'use client';

// A date-and-time box (docs/specs/004-interface-design/date-fields.md "Times and ranges"): a `datetime-local` box
// showing a stored moment in the viewer's own zone, with the date box's rules. A whole value saves at once, a
// part-typed one waits, leaving puts the saved one back, and clearing clears it. Saves the UTC instant with the zone
// it was set in.
import { TextInput } from '@liveplanner/ui';
import { fromLocalInput, localInputValue } from '@liveplanner/items';
import { useEffect, useRef, type InputHTMLAttributes } from 'react';

// Four-digit years only, as the date box.
const MIN = '1000-01-01T00:00';
const MAX = '9999-12-31T23:59';

export function DateTimeInput({
  id,
  value,
  disabled,
  label,
  tz,
  onCommit,
}: {
  id?: string;
  // The stored moment, or undefined for none.
  value: string | undefined;
  disabled?: boolean;
  label?: string;
  // The zone to show and read the moment in; the viewer's own when absent.
  tz?: string;
  // A whole moment to save, or undefined to clear it. Called only when it differs from `value`.
  onCommit: (value: string | undefined) => void;
}) {
  const inner = useRef<HTMLInputElement>(null);
  const shown = localInputValue(value, tz);

  // A change from elsewhere shows at once, unless the box is being typed in.
  useEffect(() => {
    const el = inner.current;
    if (el && el.ownerDocument.activeElement !== el && el.value !== shown) el.value = shown;
  }, [shown]);

  const props: InputHTMLAttributes<HTMLInputElement> = {
    type: 'datetime-local',
    min: MIN,
    max: MAX,
    step: 60,
    defaultValue: shown,
    onChange: (e) => {
      const el = e.currentTarget;
      if (el.value === '') {
        // Some parts typed and others empty reads as '' too: that waits.
        if (!el.validity.badInput && value !== undefined) onCommit(undefined);
        return;
      }
      if (el.value === shown) return;
      const next = fromLocalInput(el.value, tz);
      if (next !== undefined) onCommit(next);
    },
    onBlur: (e) => {
      const el = e.currentTarget;
      if (el.value !== shown || el.validity.badInput) el.value = shown;
    },
  };
  return (
    <TextInput
      ref={inner}
      id={id}
      aria-label={label}
      disabled={disabled}
      compact
      className="tabular-nums"
      {...props}
    />
  );
}
