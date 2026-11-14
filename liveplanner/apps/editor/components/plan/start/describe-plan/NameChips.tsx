'use client';

// A row of names in Describe a Plan's preview (docs/specs/026-plan/describe-a-plan.md "The preview"): a board's columns
// or a Choice field's options, each a chip renamed in place and removed with its ×, then Add at the end while there is
// room. A chip with a problem is ringed and its words said under the row; a new chip takes focus with its name
// selected, so typing replaces it.

import { useEffect, useRef } from 'react';
import { CloseIcon, PlusIcon, Tooltip } from '@liveplanner/ui';

export function NameChips({
  names,
  noun,
  max,
  maxLength,
  problemAt,
  onRename,
  onRemove,
  onAdd,
  size = 'md',
}: {
  names: readonly string[];
  // What each chip is ("Column", "Option"), for its labels and the Add button.
  noun: string;
  max: number;
  maxLength: number;
  // The problem said at chip `i`, if any.
  problemAt: (i: number) => string | undefined;
  onRename: (i: number, name: string) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  size?: 'sm' | 'md';
}) {
  const row = useRef<HTMLDivElement>(null);
  // The count before the last Add: a chip beyond it is new, and takes focus.
  const added = useRef<number | null>(null);
  useEffect(() => {
    if (added.current === null || names.length <= added.current) return;
    const inputs = row.current?.querySelectorAll('input');
    const fresh = inputs?.[names.length - 1];
    fresh?.focus();
    fresh?.select();
    added.current = null;
  }, [names.length]);
  // Each different problem in the row, once: two chips of one name both ring and the words are said once, so neither
  // hides behind the other's focus ring; a second kind of problem (an empty chip too) is said under it.
  const said = [
    ...new Set(
      names.flatMap((_, i) => {
        const p = problemAt(i);
        return p ? [p] : [];
      }),
    ),
  ];
  const small = size === 'sm';
  return (
    <div className="flex flex-col gap-1.5">
      <div ref={row} className="flex flex-wrap items-center gap-1.5">
        {names.map((name, i) => {
          const problem = problemAt(i);
          const label = name.trim() || `${noun} ${i + 1}`;
          return (
            <span
              // Index keys: a chip is its place in the row, and its name changes as it is typed.
              key={i}
              // A chip with a problem keeps it rose while it is typed in: its focus ring is rose, not the brand's.
              className={`flex items-center rounded-full border bg-white pl-2.5 pr-0.5 transition focus-within:ring-2 motion-reduce:transition-none dark:bg-slate-900 ${
                problem
                  ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-400/30 dark:border-rose-400/70 dark:focus-within:border-rose-400 dark:focus-within:ring-rose-400/35'
                  : 'border-slate-200 focus-within:border-brand-400 focus-within:ring-brand-400/25 dark:border-slate-700'
              }`}
            >
              <input
                aria-label={`${noun} ${i + 1}`}
                aria-invalid={problem ? true : undefined}
                value={name}
                maxLength={maxLength}
                size={Math.max(4, Math.min(28, name.length + 1))}
                onChange={(e) => onRename(i, e.target.value)}
                className={`min-w-0 bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 ${
                  small ? 'py-0.5 text-[12px]' : 'py-1 text-[13px]'
                } pointer-coarse:py-2`}
              />
              <Tooltip label={`Remove ${label}`}>
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => onRemove(i)}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none pointer-coarse:size-9 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <CloseIcon size={12} />
                </button>
              </Tooltip>
            </span>
          );
        })}
        {names.length < max ? (
          <button
            type="button"
            onClick={() => {
              added.current = names.length;
              onAdd();
            }}
            className={`flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none pointer-coarse:py-2 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-400/70 dark:hover:bg-brand-500/10 dark:hover:text-brand-100 ${
              small ? 'py-0.5 text-[12px]' : 'py-1 text-[13px]'
            }`}
          >
            <PlusIcon size={12} aria-hidden />
            Add {noun}
          </button>
        ) : null}
      </div>
      {said.map((p) => (
        <ProblemText key={p}>{p}</ProblemText>
      ))}
    </div>
  );
}

// A problem's words beside its place: rose, small, read out as it appears.
export function ProblemText({ children, id }: { children: string; id?: string }) {
  return (
    <p id={id} role="status" className="text-[12px] text-rose-700 dark:text-rose-300">
      {children}
    </p>
  );
}
