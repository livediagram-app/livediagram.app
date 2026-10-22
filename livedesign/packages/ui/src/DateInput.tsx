'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { TextInput, type TextInputProps } from './TextInput';

// The shared date field (docs/specs/004-interface-design/date-fields.md "Typing and saving").
// A native date input reports every keystroke: the first digit of a year reads as 0002, and a
// field with an empty segment reads as ''. Saving each of those as it came cleared the day and
// month mid-typing, so this saves only a whole date, waits on a part-typed one, and puts the
// saved date back when a part-typed one is left.

// The first year a typed date counts as whole: below it, the year is still being typed.
export const DATE_YEAR_MIN = 1000;
const DATE_MIN = '1000-01-01';
// Four-digit years only: the browser's year segment otherwise takes six.
const DATE_MAX = '9999-12-31';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar day, `YYYY-MM-DD`, with a whole year (no 31 April, no 0002).
export function isWholeDay(s: string): boolean {
  const m = DAY.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < DATE_YEAR_MIN) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export type DateCommit = { kind: 'set'; day: string } | { kind: 'clear' } | { kind: 'wait' };

// What a date field's raw value means. `partial` is the browser's `validity.badInput`: some
// segments typed, others empty, which also reads as ''.
export function dateCommit(raw: string, partial: boolean): DateCommit {
  if (raw === '') return partial ? { kind: 'wait' } : { kind: 'clear' };
  return isWholeDay(raw) ? { kind: 'set', day: raw } : { kind: 'wait' };
}

// Opens the system date picker on a date field, or focuses it where the browser has no
// `showPicker` (or refuses it, e.g. without a user gesture).
export function openDatePicker(el: HTMLInputElement): void {
  try {
    if (typeof el.showPicker === 'function') {
      el.showPicker();
      return;
    }
  } catch {
    // Falls through to focus.
  }
  el.focus();
}

export type DateInputProps = Omit<
  TextInputProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & {
  // The saved day, `YYYY-MM-DD`, or undefined for none.
  value: string | undefined;
  // A whole day to save, or undefined to clear it. Called only when it differs from `value`.
  onCommit: (day: string | undefined) => void;
  // Drops the shared field look for the caller's own `className` (a denser menu's fields).
  unstyled?: boolean;
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onCommit, onBlur, onKeyDown, unstyled = false, compact, invalid, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  const saved = value ?? '';
  // A part-typed date reads as '' like an empty one, so setting '' does not reset its
  // segments everywhere; a fresh input does. Bumped only to drop a part-typed date.
  const [resets, setResets] = useState(0);
  const refocus = useRef(false);

  // A change from elsewhere shows at once, unless the field is being typed in.
  useEffect(() => {
    const el = inner.current;
    if (el && el.ownerDocument.activeElement !== el && el.value !== saved) el.value = saved;
  }, [saved]);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    inner.current?.focus();
  }, [resets]);

  // Puts the saved date back over whatever is typed.
  const restore = (el: HTMLInputElement, keepFocus: boolean) => {
    if (el.validity.badInput) {
      refocus.current = keepFocus;
      setResets((n) => n + 1);
    } else if (el.value !== saved) el.value = saved;
  };

  const props: InputHTMLAttributes<HTMLInputElement> = {
    type: 'date',
    min: DATE_MIN,
    max: DATE_MAX,
    defaultValue: saved,
    ...rest,
    onChange: (e) => {
      const c = dateCommit(e.currentTarget.value, e.currentTarget.validity.badInput);
      if (c.kind === 'set' && c.day !== saved) onCommit(c.day);
      else if (c.kind === 'clear' && saved !== '') onCommit(undefined);
    },
    onBlur: (e) => {
      restore(e.currentTarget, false);
      onBlur?.(e);
    },
    onKeyDown: (e) => {
      const el = e.currentTarget;
      if (e.key === 'Escape' && (el.value !== saved || el.validity.badInput)) {
        // Escape undoes the typing; a second one goes on to close whatever holds the field. Stopped
        // immediately: React listens on the root (`document` under Next), the node a Dialog's own
        // Escape listener sits on too, and stopPropagation never stops a listener on the same node.
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        restore(el, true);
      }
      onKeyDown?.(e);
    },
  };
  return unstyled ? (
    <input key={resets} ref={inner} {...props} />
  ) : (
    <TextInput key={resets} ref={inner} {...props} compact={compact} invalid={invalid} />
  );
});
