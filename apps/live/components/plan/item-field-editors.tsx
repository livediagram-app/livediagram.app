'use client';

// The item panel's field editors (docs/specs/025-plan/plan-board.md "Working on a board"), one per field
// kind: text that saves on a pause in typing, and pickers that save at once. Each calls `onSave` with
// the field's new value, or `undefined` to clear it.
import { useEffect, useRef, useState } from 'react';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  isItemPerson,
  type ItemFieldValue,
  type ItemPerson,
} from '@livediagram/items';
import { FIELD_CLASS } from './PlanSheet';

// One undo step per pause in typing (blueprint DEFAULTS D8).
export const ITEM_EDIT_DEBOUNCE_MS = 400;

type Save = (value: ItemFieldValue | undefined) => void;

// Text that saves when typing pauses, and when it loses focus.
export function DebouncedText({
  id,
  value,
  multiline,
  placeholder,
  required,
  disabled,
  onSave,
}: {
  id: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled: boolean;
  onSave: Save;
}) {
  const [draft, setDraft] = useState(value);
  const savedRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Someone else's change lands when this field is not being typed in.
  useEffect(() => {
    if (timer.current === null && value !== savedRef.current) {
      savedRef.current = value;
      setDraft(value);
    }
  }, [value]);
  const flush = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = required ? text.trim() : text;
    if (next === savedRef.current || (required && !next)) return;
    savedRef.current = next;
    onSave(next === '' ? undefined : next);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const common = {
    id,
    value: draft,
    placeholder,
    disabled,
    className: `${FIELD_CLASS} ${multiline ? 'min-h-28 resize-y' : ''}`,
    onChange: (e: { target: { value: string } }) => {
      const text = e.target.value;
      setDraft(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(text), ITEM_EDIT_DEBOUNCE_MS);
    },
    onBlur: () => flush(draft),
  };
  return multiline ? <textarea {...common} /> : <input {...common} />;
}

export function PersonPicker({
  id,
  value,
  people,
  disabled,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  people: readonly ItemPerson[];
  disabled: boolean;
  onSave: Save;
}) {
  const current = isItemPerson(value) ? value : null;
  const options =
    current && !people.some((p) => p.id === current.id) ? [current, ...people] : people;
  return (
    <select
      id={id}
      className={FIELD_CLASS}
      disabled={disabled}
      value={current?.id ?? ''}
      onChange={(e) => {
        const p = options.find((o) => o.id === e.target.value);
        onSave(p ? { ...p } : undefined);
      }}
    >
      <option value="">No one</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
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
    <select
      id={id}
      className={FIELD_CLASS}
      disabled={disabled}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onSave(e.target.value || undefined)}
    >
      <option value="">None</option>
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABELS[p]}
        </option>
      ))}
    </select>
  );
}

export function LabelsEditor({
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
  const labels = Array.isArray(value)
    ? value.filter((l): l is string => typeof l === 'string')
    : [];
  const [draft, setDraft] = useState('');
  const add = () => {
    const l = draft.trim().replace(/^#/, '');
    if (!l || labels.includes(l)) return setDraft('');
    onSave([...labels, l]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[12px] dark:bg-slate-800"
        >
          {l}
          {disabled ? null : (
            <button
              type="button"
              aria-label={`Remove label ${l}`}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={() => {
                const next = labels.filter((x) => x !== l);
                onSave(next.length ? next : undefined);
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {disabled ? null : (
        <input
          id={id}
          value={draft}
          placeholder="Add a label"
          className="min-w-24 flex-1 bg-transparent text-[13px] outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}

export function NumberField({
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
    <input
      id={id}
      type="number"
      min={0}
      max={999}
      step="any"
      disabled={disabled}
      className={FIELD_CLASS}
      defaultValue={typeof value === 'number' ? value : ''}
      key={typeof value === 'number' ? value : 'none'}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        const n = Number(raw);
        if (raw === '') onSave(undefined);
        else if (Number.isFinite(n) && n >= 0 && n <= 999 && n !== value) onSave(n);
      }}
    />
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
  return (
    <input
      id={id}
      type="date"
      disabled={disabled}
      className={FIELD_CLASS}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onSave(e.target.value || undefined)}
    />
  );
}

type Row = { text: string; done: boolean };

export function ChecklistEditor({
  value,
  disabled,
  onSave,
}: {
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  const rows: Row[] = Array.isArray(value)
    ? value.flatMap((r) =>
        r && typeof r === 'object' && !Array.isArray(r) && typeof r.text === 'string'
          ? [{ text: r.text, done: r.done === true }]
          : [],
      )
    : [];
  const [draft, setDraft] = useState('');
  const save = (next: Row[]) => onSave(next.length ? next : undefined);
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <div key={i} className="group flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={r.done}
            disabled={disabled}
            aria-label={r.text}
            onChange={() => save(rows.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
          />
          <span className={r.done ? 'flex-1 text-slate-400 line-through' : 'flex-1'}>{r.text}</span>
          {disabled ? null : (
            <button
              type="button"
              aria-label={`Remove ${r.text}`}
              className="text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-700 focus:opacity-100"
              onClick={() => save(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {disabled ? null : (
        <input
          value={draft}
          placeholder="Add a step"
          className="bg-transparent text-[13px] outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              save([...rows, { text: draft.trim().slice(0, 200), done: false }]);
              setDraft('');
            }
          }}
        />
      )}
    </div>
  );
}
