'use client';

// A question type picked from a list of its icon and name (docs/specs/030-forms/forms.md "Question types"): the
// selected question's Type button, and the add bar's Add Question. A radio list in a popover: arrows move, Enter
// picks.
import { useRef, useState, type ReactNode } from 'react';
import { QUESTION_TYPE_NAMES, type QuestionType } from '@liveplanner/forms';
import { ChevronDownIcon } from '@liveplanner/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { QUESTION_TYPE_ICONS, QUESTION_TYPE_ORDER } from './question-icons';

export function QuestionTypeList({
  value,
  onPick,
  label,
}: {
  value: QuestionType | null;
  onPick: (type: QuestionType) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, value ? QUESTION_TYPE_ORDER.indexOf(value) : 0);
  return (
    <div role="listbox" aria-label={label} className="flex flex-col py-1">
      {QUESTION_TYPE_ORDER.map((t, i) => {
        const Icon = QUESTION_TYPE_ICONS[t];
        const on = t === value;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="option"
            aria-selected={on}
            tabIndex={i === at ? 0 : -1}
            onClick={() => onPick(t)}
            onKeyDown={(e) => {
              const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : null;
              if (to === null) return;
              e.preventDefault();
              refs.current[(to + QUESTION_TYPE_ORDER.length) % QUESTION_TYPE_ORDER.length]?.focus();
            }}
            className={`flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2.5 text-left text-[13px] outline-none transition focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 ${
              on
                ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Icon aria-hidden className="shrink-0 opacity-80" />
            {QUESTION_TYPE_NAMES[t]}
          </button>
        );
      })}
    </div>
  );
}

// A button opening the list in a popover.
export function QuestionTypeMenu({
  value,
  onPick,
  children,
  className,
  label,
  disabled = false,
}: {
  value: QuestionType | null;
  onPick: (type: QuestionType) => void;
  children: ReactNode;
  className: string;
  label: string;
  disabled?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `${label}: ${QUESTION_TYPE_NAMES[value]}` : label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        {children}
      </button>
      {open && anchor ? (
        <AnchoredPopover anchor={anchor} name={label} width={220} onClose={() => setOpen(false)}>
          <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <QuestionTypeList
              value={value}
              label={label}
              onPick={(t) => {
                setOpen(false);
                onPick(t);
                anchor.focus();
              }}
            />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

export function TypeButtonFace({ type }: { type: QuestionType }) {
  const Icon = QUESTION_TYPE_ICONS[type];
  return (
    <>
      <Icon aria-hidden className="shrink-0" />
      <span className="truncate">{QUESTION_TYPE_NAMES[type]}</span>
      <ChevronDownIcon className="shrink-0 opacity-60" />
    </>
  );
}
