'use client';

// The parts a settings cog's sections are built from (a Sheet's Sheet Settings, a Dashboard's): a section's padded
// body, a labelled field, and a tile for a one-press action, as the element menu's tiles look.
import type { MouseEvent, ReactNode } from 'react';

export function SettingsBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 px-3 pb-3 pt-1">{children}</div>;
}

export function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function SettingsActionTile({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 disabled:cursor-default disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-800 dark:disabled:hover:text-slate-200"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}
