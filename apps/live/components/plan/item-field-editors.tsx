'use client';

// The item panel's field editors (docs/specs/026-plan/plan-board.md "Working on a board"), one per field
// kind: text that saves on a pause in typing, and pickers that save at once. Each calls `onSave` with
// the field's new value, or `undefined` to clear it.
import { ChipField } from '@/components/primitives/ChipField';
import { CheckIcon, CloseIcon, PlusIcon, Select, TextInput, TextArea } from '@livediagram/ui';
import { useEffect, useRef, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  ESTIMATE_POINTS,
  PRIORITIES,
  PRIORITY_LABELS,
  isItemPerson,
  type ItemFieldValue,
  type ItemPerson,
} from '@livediagram/items';

// One undo step per pause in typing (blueprint DEFAULTS D8).
export const ITEM_EDIT_DEBOUNCE_MS = 400;

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
}: {
  id: string;
  value: string;
  multiline?: boolean;
  // The most characters the field takes: typing stops there, and a count shows near it.
  maxLength?: number;
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
  const flush = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = required ? text.trim() : text;
    if (next === savedRef.current || (required && !next)) return;
    savedRef.current = next;
    void Promise.resolve(onSave(next === '' ? undefined : next)).then((ok) => {
      // Refused: back to what is saved, unless a newer edit is already on its way.
      if (ok !== false || savedRef.current !== next) return;
      savedRef.current = valueRef.current;
      setDraft(valueRef.current);
    });
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
    maxLength,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => {
      const text = e.target.value;
      setDraft(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(text), ITEM_EDIT_DEBOUNCE_MS);
    },
    onBlur: () => flush(draft),
  };
  // Near the limit, how many characters are left (from 90% of it), so the stop never surprises.
  const left = maxLength === undefined ? null : maxLength - draft.length;
  const count =
    left !== null && maxLength !== undefined && draft.length >= maxLength * 0.9 ? (
      <span
        aria-live="polite"
        className={`mt-1 block text-right text-[11px] tabular-nums ${left === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400 dark:text-slate-400'}`}
      >
        {left === 0
          ? `${maxLength} characters, the most it takes`
          : `${left} ${left === 1 ? 'character' : 'characters'} left`}
      </span>
    ) : null;
  // A caller's own look replaces the shared field (the item panel's large title).
  const field = className ? (
    multiline ? (
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
    <Select
      id={id}
      className="w-full"
      selectClassName="text-[13px]"
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
    </Select>
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
    <Select
      id={id}
      className="w-full"
      selectClassName="text-[13px]"
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
    </Select>
  );
}

// A label's colour: one of the Plan swatches, the same for the same label everywhere (label-colour.ts).
export { labelColour } from './label-colour';
import { labelColour } from './label-colour';

export function LabelsEditor({
  id,
  value,
  disabled,
  suggestions = [],
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  // Labels other items of the document carry, offered as the field is typed in.
  suggestions?: readonly string[];
  onSave: Save;
}) {
  const labels = Array.isArray(value)
    ? value.filter((l): l is string => typeof l === 'string')
    : [];
  const [draft, setDraft] = useState('');
  const addLabels = (texts: readonly string[]) => {
    const next = [...labels];
    for (const t of texts) {
      const l = t.trim().replace(/^#/, '');
      if (l && !next.includes(l)) next.push(l);
    }
    if (next.length !== labels.length) onSave(next);
  };
  const remove = (l: string) => {
    const next = labels.filter((x) => x !== l);
    onSave(next.length ? next : undefined);
  };
  const offered = suggestions.filter((s) => !labels.includes(s));
  return (
    <ChipField
      compact
      id={id}
      chips={labels}
      chipStyle={(l) => {
        const c = labelColour(l);
        return { backgroundColor: `${c}1f`, color: c };
      }}
      removeLabel={(l) => `Remove label ${l}`}
      draft={draft}
      onDraftChange={(value) => {
        // A comma (typed or pasted) adds what comes before it.
        if (!value.includes(',')) return setDraft(value);
        const parts = value.split(',');
        addLabels(parts.slice(0, -1));
        setDraft(parts[parts.length - 1]!);
      }}
      onCommit={() => {
        addLabels([draft]);
        setDraft('');
      }}
      onBlur={() => {
        addLabels([draft]);
        setDraft('');
      }}
      onRemove={remove}
      readOnly={disabled}
      emptyText="None"
      placeholder={labels.length ? 'Add…' : 'Add a label'}
      list={offered.length ? `${id}-labels` : undefined}
    >
      {!disabled && offered.length ? (
        <datalist id={`${id}-labels`}>
          {offered.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </ChipField>
  );
}

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
      selectClassName="text-[13px]"
      disabled={disabled}
      value={current === undefined ? '' : String(current)}
      onChange={(e) => onSave(e.target.value === '' ? undefined : Number(e.target.value))}
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
  return (
    <TextInput
      id={id}
      type="date"
      disabled={disabled}
      compact
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
  const done = rows.filter((r) => r.done).length;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.length > 0 ? (
        <div className="mb-1 flex items-center gap-2.5">
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            aria-hidden
          >
            <span
              className={`block h-full rounded-full transition-all ${done === rows.length ? 'bg-green-600' : 'bg-brand-500'}`}
              style={{ width: `${(done / rows.length) * 100}%` }}
            />
          </span>
          <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
            {done} of {rows.length}
          </span>
        </div>
      ) : null}
      <ul className="flex flex-col">
        {rows.map((r, i) => (
          <li
            key={i}
            className="group -mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={r.done}
              aria-label={r.text}
              disabled={disabled}
              onClick={() => save(rows.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition enabled:cursor-pointer ${
                r.done
                  ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-600 dark:bg-brand-600'
                  : 'border-slate-300 hover:border-brand-500 dark:border-slate-600'
              }`}
            >
              {r.done ? <CheckIcon size={11} /> : null}
            </button>
            {disabled ? (
              <span className={`flex-1 text-[13px] ${r.done ? 'text-slate-400 line-through' : ''}`}>
                {r.text}
              </span>
            ) : (
              <input
                aria-label={`Step ${i + 1}`}
                defaultValue={r.text}
                key={r.text}
                maxLength={200}
                className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[13px] outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 dark:focus:bg-slate-900 ${
                  r.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (!text) save(rows.filter((_, j) => j !== i));
                  else if (text !== r.text)
                    save(rows.map((x, j) => (j === i ? { ...x, text } : x)));
                }}
              />
            )}
            {disabled ? null : (
              <button
                type="button"
                aria-label={`Remove ${r.text}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 [@media(pointer:coarse)]:opacity-100"
                onClick={() => save(rows.filter((_, j) => j !== i))}
              >
                <CloseIcon size={10} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {disabled ? (
        rows.length === 0 ? (
          <span className="text-[13px] text-slate-500 dark:text-slate-400">No steps</span>
        ) : null
      ) : (
        <label className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1 text-slate-500 focus-within:bg-slate-50 dark:text-slate-400 dark:focus-within:bg-slate-800/60">
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden>
            <PlusIcon size={14} />
          </span>
          <input
            value={draft}
            placeholder="Add a step"
            aria-label="Add a step"
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                save([...rows, { text: draft.trim().slice(0, 200), done: false }]);
                setDraft('');
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
