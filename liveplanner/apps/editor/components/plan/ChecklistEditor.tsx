'use client';

// A card's checklist in the item panel (docs/specs/026-plan/plan-board.md "Checklist"): a progress bar and "2 of 5"
// over its steps, each ticked with a rounded box, its text edited in place and taken off with ×, then Add a step. A
// long step wraps onto as many lines as it needs (never scrolling inside its row), its lines starting under its first
// word, a long URL breaking rather than running past the row; the box and the × sit centred against the whole step.
import { CheckIcon, CloseIcon, PlusIcon } from '@liveplanner/ui';
import { useRef, useState } from 'react';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import type { ItemFieldValue } from '@liveplanner/items';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;
type Row = { text: string; done: boolean };

// The most characters a step holds (items.md "Limits").
const STEP_MAX = 200;
// The tallest an edited step grows before it scrolls: past what 200 characters wrap to on the narrowest phone.
export const CHECKLIST_STEP_LINES = 12;
// A step's words: wrapped at a comfortable height, a long URL or word broken rather than overflowing.
const STEP_TEXT = 'text-[13px] leading-[1.45] [overflow-wrap:anywhere]';

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
      {/* Steps sit a little further apart (2 px) than their own lines. */}
      <ul className="flex flex-col gap-0.5">
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
              onClick={() => void save(rows.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition enabled:cursor-pointer ${
                r.done
                  ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
                  : 'border-slate-300 hover:border-brand-500 dark:border-slate-600'
              }`}
            >
              {r.done ? <CheckIcon size={11} /> : null}
            </button>
            {disabled ? (
              <span
                className={`min-w-0 flex-1 px-1 py-0.5 ${STEP_TEXT} ${r.done ? 'text-slate-500 dark:text-slate-400 line-through' : ''}`}
              >
                {r.text}
              </span>
            ) : (
              <ChecklistStepText
                key={r.text}
                index={i}
                text={r.text}
                done={r.done}
                onCommit={(text) => {
                  if (!text) void save(rows.filter((_, j) => j !== i));
                  else if (text !== r.text)
                    void save(rows.map((x, j) => (j === i ? { ...x, text } : x)));
                }}
              />
            )}
            {disabled ? null : (
              <button
                type="button"
                aria-label={`Remove ${r.text}`}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 [@media(pointer:coarse)]:opacity-100"
                onClick={() => void save(rows.filter((_, j) => j !== i))}
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
              // Escape leaves the new step's field, its text kept, and goes no further (never closing the card).
              if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.blur();
                return;
              }
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                void save([...rows, { text: draft.trim().slice(0, STEP_MAX), done: false }]);
                setDraft('');
              }
            }}
          />
        </label>
      )}
    </div>
  );
}

// One step's text, edited in place: a textarea of one line that grows as the text wraps (never a row that scrolls
// sideways). Enter saves it, as leaving it does; a line break pasted in becomes a space, so a step stays one line of
// text. Escape cancels the edit (the step back as saved) and goes no further, so it never closes the card; a second
// Escape, focus now on the panel, does. Keyed by the saved text, so a change from elsewhere starts it afresh.
function ChecklistStepText({
  index,
  text,
  done,
  onCommit,
}: {
  index: number;
  text: string;
  done: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Set by Escape: the blur it causes saves nothing.
  const cancelled = useRef(false);
  useAutoHeight(ref, draft, { lines: CHECKLIST_STEP_LINES });
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={`Step ${index + 1}`}
      value={draft}
      maxLength={STEP_MAX}
      className={`block min-w-0 flex-1 resize-none rounded bg-transparent px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 dark:focus:bg-slate-900 ${STEP_TEXT} ${
        done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'
      }`}
      onChange={(e) => setDraft(e.target.value.replace(/\r?\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          setDraft(text);
          e.currentTarget.blur();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          return;
        }
        onCommit(draft.trim());
      }}
    />
  );
}
