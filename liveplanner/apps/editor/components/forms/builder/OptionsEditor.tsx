'use client';

// A choice question's options, edited in place (docs/specs/030-forms/forms.md "Question types"): each a row of its
// grip, its mark (a radio dot or a checkbox) and its name. Enter adds the next option after it, Backspace in an empty
// one removes it, dragging its grip (or Alt+Up and Alt+Down, or the arrow keys on the grip) moves it, pasting several
// lines adds one option a line, and Add Other adds the free text option. Options are unique ignoring case: a repeat is put back to what it was.
import { useEffect, useRef } from 'react';
import { OPTIONS_MAX, OPTION_MAX, type FormQuestion } from '@liveplanner/forms';
import { CloseIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideGripVertical } from '@liveworkspace/icons/lucide';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import { nextOptionName, pastedOptions } from '@liveplanner/forms';
import { DraftText, type DraftTextHandle } from './DraftText';
import { movedOption, useOptionDrag } from './useOptionDrag';

const GripIcon = lucideGlyph(lucideGripVertical, 14);

export function OptionsEditor({
  question,
  onOptions: save,
  onOther,
}: {
  question: FormQuestion;
  onOptions: (options: string[]) => void;
  onOther: (other: boolean) => void;
}) {
  const stored = question.options ?? [];
  // The options as last set here, read by every change below. One key can make two changes before the next draw
  // (Enter saves the name just typed, then adds the option after it): the second must build on the first, or the
  // name typed was shown and never kept.
  const latest = useRef(stored);
  useAssignRef(latest, stored);
  const options = stored;
  const onOptions = (next: string[]) => {
    latest.current = next;
    save(next);
  };
  const refs = useRef<(DraftTextHandle | null)[]>([]);
  const grips = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // The option to focus once drawn (one just added, or the one before a removed one), or its grip (one just moved
  // from its grip).
  const pendingFocus = useRef<{ at: number; grip: boolean } | null>(null);
  const setFocus = (at: number, grip = false) => {
    pendingFocus.current = { at, grip };
  };
  useEffect(() => {
    const next = pendingFocus.current;
    if (!next) return;
    (next.grip ? grips.current[next.at] : refs.current[next.at])?.focus();
    pendingFocus.current = null;
  });
  const drag = useOptionDrag(listRef, (from, gap) => {
    const now = latest.current;
    const next = movedOption(now, from, gap);
    if (next.some((o, i) => o !== now[i])) onOptions(next);
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
    const now = latest.current;
    const name = text.trim();
    if (!name) return;
    if (now.some((o, j) => j !== i && o.toLowerCase() === name.toLowerCase())) return;
    onOptions(now.map((o, j) => (j === i ? name : o)));
  };
  const insertAfter = (i: number) => {
    const now = latest.current;
    if (now.length >= OPTIONS_MAX) return;
    const next = [...now];
    next.splice(i + 1, 0, nextOptionName(now));
    onOptions(next);
    setFocus(i + 1);
  };
  const remove = (i: number) => {
    const now = latest.current;
    if (now.length <= 1) return;
    onOptions(now.filter((_, j) => j !== i));
    setFocus(Math.max(0, i - 1));
  };
  const move = (i: number, by: -1 | 1, grip = false) => {
    const now = latest.current;
    const to = i + by;
    if (to < 0 || to >= now.length) return;
    const next = [...now];
    [next[i], next[to]] = [next[to]!, next[i]!];
    onOptions(next);
    setFocus(to, grip);
  };
  const gripTip = `Drag to Reorder (${keyLabel('Alt-')}↑ ${keyLabel('Alt-')}↓)`;
  return (
    <div ref={listRef} className="relative flex flex-col gap-1" role="list" aria-label="Options">
      {drag.mark ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-5 right-0 h-0.5 -translate-y-[3px] rounded-full bg-[var(--form-accent)]"
          style={{ top: drag.mark.top }}
        />
      ) : null}
      {options.map((o, i) => (
        <div
          key={i}
          role="listitem"
          data-form-option={i}
          className={`group/opt relative flex min-h-9 items-center gap-2.5 rounded-md px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${drag.from === i ? 'opacity-40' : ''}`}
        >
          {/* In the gutter beside the row, so the marks keep their line with Other and Add Option under them. */}
          {options.length > 1 ? (
            <Tooltip label={gripTip}>
              <button
                ref={(el) => {
                  grips.current[i] = el;
                }}
                type="button"
                aria-label={`${o}: ${gripTip}`}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                onPointerDown={(e) => drag.grab(e, i)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                  e.preventDefault();
                  // Not the question's own Alt+arrows, which move the question.
                  e.stopPropagation();
                  move(i, e.key === 'ArrowUp' ? -1 : 1, true);
                }}
                className={`absolute -left-5 top-0 flex h-full w-5 cursor-grab touch-none items-center justify-center rounded text-slate-400 transition hover:text-slate-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] group-hover/opt:opacity-100 [@media(hover:none)]:opacity-100 dark:text-slate-500 dark:hover:text-slate-300 ${drag.from === null ? 'opacity-0' : 'cursor-grabbing opacity-100'}`}
              >
                <GripIcon />
              </button>
            </Tooltip>
          ) : null}
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
              const next = pastedOptions(latest.current, i, text);
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
                // A name still being typed is kept first: saved after the move, it would name the option that
                // took this one's place.
                refs.current[i]?.flush();
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
