'use client';

// The builder's toggle chip (a rule's answers, a column, the preview's card type): brand when on, a quiet outline
// when off. `role="radio"` for one-of choices; a pressed toggle otherwise.
import type { ReactNode } from 'react';

export function ChoiceChip({
  on,
  onClick,
  disabled = false,
  radio = false,
  small = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  radio?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...(radio ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on })}
      disabled={disabled}
      onClick={onClick}
      className={`flex ${small ? 'h-7 px-2.5' : 'h-8 px-3'} cursor-pointer items-center gap-1.5 rounded-full border text-[12px] font-medium transition disabled:cursor-default ${
        on
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
      }`}
    >
      <span className="text-optical-centre">{children}</span>
    </button>
  );
}

// A board's columns as one-of chips, each its colour dot and name.
export function ColumnChips({
  columns,
  status,
  onPick,
  disabled = false,
}: {
  columns: readonly { id: string; status: string; name?: string; color?: string }[];
  status: string | undefined;
  onPick: (status: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {columns.map((c) => (
        <ChoiceChip
          key={c.id}
          radio
          on={c.status === status}
          disabled={disabled}
          onClick={() => onPick(c.status)}
        >
          {c.color ? (
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c.color }} />
          ) : null}
          <span className="text-optical-centre">{c.name || 'Untitled'}</span>
        </ChoiceChip>
      ))}
    </>
  );
}
