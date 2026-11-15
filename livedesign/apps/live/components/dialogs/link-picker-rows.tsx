import type { ReactNode } from 'react';
import { Glyph } from '@livedesign/ui';

// The link picker's rows (LinkPickerDialog and its Screen mode): a destination with its glyph, marked when it is
// the one linked now.
export function RowButton({
  active,
  icon,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  icon?: ReactNode;
  onClick: () => void;
  // Shown, never pressable (the screen the element sits on).
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={
        disabled
          ? 'flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400'
          : active
            ? 'flex w-full items-center gap-2.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-left text-sm font-medium text-brand-800 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
            : 'flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      <span
        className={
          active
            ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
        }
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
      {active ? <CheckGlyph /> : null}
    </button>
  );
}

function CheckGlyph() {
  return (
    <Glyph size={14} units={16} className="shrink-0">
      <path d="M3.5 8.5l3 3 6-6.5" />
    </Glyph>
  );
}
