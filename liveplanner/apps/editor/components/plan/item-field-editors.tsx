'use client';

// The item panel's field editors (docs/specs/026-plan/plan-board.md "Working on a board"), one per field
// kind: text that saves on a pause in typing, and pickers that save at once. Each calls `onSave` with
// the field's new value, or `undefined` to clear it.
import { DateInput, Select, TextInput, TextArea } from '@liveplanner/ui';
import { useEffect, useRef, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import {
  ESTIMATE_POINTS,
  PRIORITIES,
  PRIORITY_LABELS,
  type ItemFieldValue,
} from '@liveplanner/items';

// One undo step per pause in typing (blueprint DEFAULTS D8).
const ITEM_EDIT_DEBOUNCE_MS = 400;

// A save may report whether it landed: false (refused, by the store or the api) puts the field back to what is
// saved, so it never shows a value nobody kept.
type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

// Text that saves when typing pauses, and when it loses focus.
export function DebouncedText({
  id,
  value,
  multiline,
  placeholder,
  required,
  disabled,
  onSave,
  className,
  label,
  maxLength,
  onEnter,
  wrapLines,
}: {
  id: string;
  value: string;
  multiline?: boolean;
  // One line of text that wraps, growing to this many lines and then scrolling (the card panel's title: 3). A short
  // value takes one line; Enter still saves (onEnter), and a line break pasted in becomes a space.
  wrapLines?: number;
  // The most characters the field takes: typing stops there, and a count shows near it.
  maxLength?: number;
  // Enter on a one-line field: what follows once it has saved (the card's title closes the card). Not called when
  // the save is refused, so the field (gone back to what is saved) stays to be fixed.
  onEnter?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled: boolean;
  onSave: Save;
  // Replaces the field look (the item panel's large title).
  className?: string;
  // An accessible name when no label element names it.
  label?: string;
}) {
  const [draft, setDraft] = useState(value);
  const wrapRef = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(wrapRef, draft, { lines: wrapLines ?? 1 });
  const savedRef = useRef(value);
  // The saved value as last received, to go back to when a save is refused.
  const valueRef = useLatest(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Someone else's change lands when this field is not being typed in.
  useEffect(() => {
    if (timer.current === null && value !== savedRef.current) {
      savedRef.current = value;
      setDraft(value);
    }
  }, [value]);
  // Saves what is typed; resolves whether it landed (true when there was nothing to save).
  const flush = (text: string): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = required ? text.trim() : text;
    if (next === savedRef.current || (required && !next)) return Promise.resolve(true);
    savedRef.current = next;
    return Promise.resolve(onSave(next === '' ? undefined : next)).then((ok) => {
      // Refused: back to what is saved, unless a newer edit is already on its way.
      if (ok !== false || savedRef.current !== next) return true;
      savedRef.current = valueRef.current;
      setDraft(valueRef.current);
      return false;
    });
  };
  // Typing still waiting on the debounce is saved when the field goes, not dropped: Escape closes the card
  // panel with focus still here, so no blur runs. The latest flush, so it saves with the newest onSave.
  const pending = useRef<string | null>(null);
  const flushLatest = useLatest(flush);
  useEffect(
    () => () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      timer.current = null;
      if (pending.current !== null) void flushLatest.current(pending.current);
    },
    [flushLatest],
  );
  const common = {
    id,
    value: draft,
    placeholder,
    disabled,
    maxLength,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => {
      // A wrapping one-line field never holds a line break (a paste brings them).
      const text = wrapLines ? e.target.value.replace(/\r?\n/g, ' ') : e.target.value;
      setDraft(text);
      pending.current = text;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(text), ITEM_EDIT_DEBOUNCE_MS);
    },
    onBlur: () => void flush(draft),
    onKeyDown:
      onEnter && !multiline
        ? (e: {
            key: string;
            preventDefault: () => void;
            nativeEvent: { isComposing?: boolean };
          }) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void flush(draft).then((ok) => ok && onEnter());
          }
        : undefined,
  };
  // Near the limit, how many characters are left (from 90% of it), so the stop never surprises.
  const left = maxLength === undefined ? null : maxLength - draft.length;
  const count =
    left !== null && maxLength !== undefined && draft.length >= maxLength * 0.9 ? (
      <span
        aria-live="polite"
        className={`mt-1 block text-right text-[11px] tabular-nums ${left === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {left === 0
          ? `${maxLength} characters, the most it takes`
          : `${left} ${left === 1 ? 'character' : 'characters'} left`}
      </span>
    ) : null;
  // A caller's own look replaces the shared field (the item panel's large title).
  const field = className ? (
    wrapLines && !multiline ? (
      <textarea {...common} ref={wrapRef} rows={1} className={`block resize-none ${className}`} />
    ) : multiline ? (
      <textarea {...common} className={className} />
    ) : (
      <input {...common} className={className} />
    )
  ) : multiline ? (
    <TextArea {...common} compact className="min-h-28 resize-y" />
  ) : (
    <TextInput {...common} compact />
  );
  return count ? (
    <div>
      {field}
      {count}
    </div>
  ) : (
    field
  );
}

// A Details select (Status, Priority, Estimate): the 34px field and slate-900 paper its neighbours (Assignee, Parent,
// Labels, Due) draw, and an empty "None" muted as theirs is, so the column reads as one set of fields.
export function detailSelectClass(empty: boolean, extra = ''): string {
  return `min-h-[34px] text-[13px] dark:bg-slate-900! ${
    empty
      ? 'text-slate-500! dark:text-slate-400! [&>option]:text-slate-700 dark:[&>option]:text-slate-200'
      : ''
  }${extra ? ` ${extra}` : ''}`;
}

export function PriorityPicker({
  id,
  value,
  disabled,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  return (
    <Select
      id={id}
      className="w-full"
      selectClassName={detailSelectClass(typeof value !== 'string' || value === '')}
      disabled={disabled}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => void onSave(e.target.value || undefined)}
    >
      <option value="">None</option>
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABELS[p]}
        </option>
      ))}
    </Select>
  );
}

// A label's colour: one of the Plan swatches, the same for the same label everywhere (label-colour.ts).
export { labelColour } from './label-colour';

// An Estimate (docs/specs/026-plan/items.md "Fields"): picked from the story-point sizes, or None. A value a card
// already holds that is not a size (set before, or by an agent) stays offered, so opening the card loses nothing.
export function EstimateSelect({
  id,
  value,
  disabled,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  const current = typeof value === 'number' ? value : undefined;
  const sizes: number[] = [...ESTIMATE_POINTS];
  if (current !== undefined && !sizes.includes(current))
    sizes.splice(
      sizes.findIndex((s) => s > current) === -1
        ? sizes.length
        : sizes.findIndex((s) => s > current),
      0,
      current,
    );
  return (
    <Select
      id={id}
      className="w-full"
      selectClassName={detailSelectClass(current === undefined)}
      disabled={disabled}
      value={current === undefined ? '' : String(current)}
      onChange={(e) => void onSave(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      <option value="">None</option>
      {sizes.map((s) => (
        <option key={s} value={String(s)}>
          {s}
        </option>
      ))}
    </Select>
  );
}

export function DateField({
  id,
  value,
  disabled,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  // Saves only a whole date (docs/specs/004-interface-design/date-fields.md "Typing and saving").
  return (
    <DateInput
      id={id}
      disabled={disabled}
      compact
      className="min-h-[34px]"
      value={typeof value === 'string' ? value : undefined}
      onCommit={(v) => void onSave(v)}
    />
  );
}

// The checklist editor has its own module (ChecklistEditor.tsx); its importers reach it here as before.
export { ChecklistEditor } from './ChecklistEditor';
