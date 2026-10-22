'use client';

// A choice question's options, edited in place (docs/specs/030-forms/forms.md "Question types"): each a row of its
// mark (a radio dot or a checkbox) and its name. Enter adds the next option after it, Backspace in an empty one
// removes it, Alt+Up and Alt+Down move it, pasting several lines adds one option a line, and Add Other adds the free
// text option. Options are unique ignoring case: a repeat is put back to what it was.
import { useEffect, useRef } from 'react';
import { OPTIONS_MAX, OPTION_MAX, type FormQuestion } from '@livedesign/forms';
import { CloseIcon } from '@livedesign/ui';
import { nextOptionName, pastedOptions } from '@livedesign/forms';
import { DraftText, type DraftTextHandle } from './DraftText';

export function OptionsEditor({
  question,
  onOptions,
  onOther,
}: {
  question: FormQuestion;
  onOptions: (options: string[]) => void;
  onOther: (other: boolean) => void;
}) {
  const options = question.options ?? [];
  const refs = useRef<(DraftTextHandle | null)[]>([]);
  // The option to focus once drawn (one just added, or the one before a removed one).
  const pendingFocus = useRef<number | null>(null);
  const setFocus = (i: number) => {
    pendingFocus.current = i;
  };
  useEffect(() => {
    if (pendingFocus.current === null) return;
    refs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  });
  const multi = question.type === 'multi';
  const mark = multi ? (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 rounded border-2 border-slate-300 dark:border-slate-600"
    />
  ) : (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600"
    />
  );
  const full = options.length >= OPTIONS_MAX;
  const rename = (i: number, text: string) => {
    const name = text.trim();
    if (!name) return;
    if (options.some((o, j) => j !== i && o.toLowerCase() === name.toLowerCase())) return;
    onOptions(options.map((o, j) => (j === i ? name : o)));
  };
  const insertAfter = (i: number) => {
    if (full) return;
    const next = [...options];
    next.splice(i + 1, 0, nextOptionName(options));
    onOptions(next);
    setFocus(i + 1);
  };
  const remove = (i: number) => {
    if (options.length <= 1) return;
    onOptions(options.filter((_, j) => j !== i));
    setFocus(Math.max(0, i - 1));
  };
  const move = (i: number, by: -1 | 1) => {
    const to = i + by;
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    [next[i], next[to]] = [next[to]!, next[i]!];
    onOptions(next);
    setFocus(to);
  };
  return (
    <div className="flex flex-col gap-1" role="list" aria-label="Options">
      {options.map((o, i) => (
        <div
          key={i}
          role="listitem"
          className="group/opt flex min-h-9 items-center gap-2.5 rounded-md px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          {mark}
          <DraftText
            ref={(h) => {
              refs.current[i] = h;
            }}
            value={o}
            maxLength={OPTION_MAX}
            label={`Option ${i + 1}`}
            selectOnFocus={/^Option \d+$/.test(o)}
            className="border-b border-transparent py-1 text-[15px] text-slate-800 focus:border-[var(--form-accent)] dark:text-slate-100"
            onSave={(text) => rename(i, text)}
            onPaste={(text) => {
              const next = pastedOptions(options, i, text);
              if (!next) return false;
              onOptions(next);
              return true;
            }}
            onKeyDown={(e, text) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertAfter(i);
              } else if (e.key === 'Backspace' && text === '' && options.length > 1) {
                e.preventDefault();
                remove(i);
              } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                move(i, e.key === 'ArrowUp' ? -1 : 1);
              }
            }}
          />
          <button
            type="button"
            aria-label={`Remove ${o}`}
            disabled={options.length <= 1}
            onClick={() => remove(i)}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover/opt:opacity-100 [@media(hover:none)]:opacity-100 disabled:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
      {question.other ? (
        <div className="flex min-h-9 items-center gap-2.5 px-1">
          {mark}
          <span className="flex-1 border-b border-dashed border-slate-300 py-1 text-[15px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Other…
          </span>
          <button
            type="button"
            aria-label="Remove Other"
            onClick={() => onOther(false)}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2.5 px-1 pt-1 text-[14px]">
        {mark}
        <button
          type="button"
          disabled={full}
          onClick={() => insertAfter(options.length - 1)}
          className="cursor-pointer text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Add Option
        </button>
        {question.other ? null : (
          <>
            <span className="text-slate-400">or</span>
            <button
              type="button"
              onClick={() => onOther(true)}
              className="cursor-pointer font-medium text-[var(--form-accent)] hover:underline"
            >
              Add “Other”
            </button>
          </>
        )}
      </div>
    </div>
  );
}
