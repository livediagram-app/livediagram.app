'use client';

// Add Field's options for a Choice or Multiple Choice field (docs/specs/026-plan/item-types.md "Fields and Tabs":
// Shape): one row a option, each with its remove cross; Add an option under them; Enter in a row adds the next,
// Backspace in an empty one takes it off, and pasting several lines adds one option a line. What it hands up is
// the options cleaned (trimmed, no blanks or repeats, at most CUSTOM_CHOICE_OPTIONS_MAX).
import { useEffect, useRef, useState } from 'react';
import { CUSTOM_CHOICE_OPTIONS_MAX, CUSTOM_CHOICE_OPTION_MAX } from '@liveplanner/items';
import { CloseIcon, PlusIcon } from '@liveplanner/ui';

/** Options as typed, read back trimmed, without blanks or repeats (case aside), at most the cap. */
export function optionsFrom(rows: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rows) {
    const o = raw.trim().slice(0, CUSTOM_CHOICE_OPTION_MAX);
    if (o && !seen.has(o.toLowerCase())) {
      seen.add(o.toLowerCase());
      out.push(o);
    }
  }
  return out.slice(0, CUSTOM_CHOICE_OPTIONS_MAX);
}

/** Rows with pasted lines put in at `at`: an empty row takes the first line, the rest go after it. */
export function pasteLines(rows: readonly string[], at: number, text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [...rows];
  const next = [...rows];
  const empty = !next[at]?.trim();
  next.splice(empty ? at : at + 1, empty ? 1 : 0, ...lines);
  return next.slice(0, CUSTOM_CHOICE_OPTIONS_MAX);
}

const ROW =
  'flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/25 motion-reduce:transition-none pointer-coarse:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-brand-500/70';

export function ChoiceOptionsEditor({
  initial,
  onChange,
}: {
  // The options to start from (coming back to a field), else one empty row.
  initial?: readonly string[] | undefined;
  onChange: (options: string[]) => void;
}) {
  const [rows, setRows] = useState<string[]>(() => (initial?.length ? [...initial] : ['']));
  // The row to focus once drawn (after Enter, Backspace, Add an option or a paste).
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (focusAt === null) return;
    list.current?.querySelectorAll<HTMLInputElement>('input')[focusAt]?.focus();
    // oxlint-disable-next-line react/set-state-in-effect
    setFocusAt(null);
  }, [focusAt]);
  const set = (next: string[], focus?: number) => {
    setRows(next);
    onChange(optionsFrom(next));
    if (focus !== undefined) setFocusAt(focus);
  };
  const full = rows.length >= CUSTOM_CHOICE_OPTIONS_MAX;
  const insertAfter = (i: number) => {
    if (full) return;
    set([...rows.slice(0, i + 1), '', ...rows.slice(i + 1)], i + 1);
  };
  const remove = (i: number) => {
    if (rows.length === 1) set([''], 0);
    else
      set(
        rows.filter((_, j) => j !== i),
        Math.max(0, i - 1),
      );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ul ref={list} className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          // Rows have no identity but their place: a removed row's neighbours take its index.
          <li key={i} className={ROW}>
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
            />
            <input
              type="text"
              aria-label={`Option ${i + 1}`}
              placeholder={`Option ${i + 1}`}
              value={row}
              maxLength={CUSTOM_CHOICE_OPTION_MAX}
              className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-50 dark:placeholder:text-slate-400"
              onChange={(e) => set(rows.map((r, j) => (j === i ? e.target.value : r)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Enter makes the next row; it never adds the field from here.
                  e.preventDefault();
                  insertAfter(i);
                } else if (e.key === 'Backspace' && row === '' && rows.length > 1) {
                  e.preventDefault();
                  remove(i);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (!/\r?\n/.test(text.trim())) return;
                e.preventDefault();
                const next = pasteLines(rows, i, text);
                // Focus the last pasted line: the rows after this one are still after it.
                set(next, Math.max(0, next.length - (rows.length - i - 1) - 1));
              }}
            />
            <button
              type="button"
              aria-label={`Remove option ${i + 1}`}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 motion-reduce:transition-none pointer-coarse:size-11 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={() => remove(i)}
            >
              <CloseIcon size={11} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={full}
        onClick={() => insertAfter(rows.length - 1)}
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-left text-[13px] text-slate-600 transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none pointer-coarse:min-h-11 dark:border-slate-600 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200"
      >
        <PlusIcon size={12} />
        Add an option
        <span className="text-slate-500 dark:text-slate-400">or paste a list</span>
      </button>
    </div>
  );
}
