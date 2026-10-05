'use client';

import type { ReactNode } from 'react';
import { CheckIcon } from '@livediagram/ui';
import { useMenuItemProps } from './menu-item-props';

// A checkable menu row (`menuitemcheckbox`): a fixed check slot (empty when unchecked, so labels
// never shift as checks come and go), the entry's own icon, then its label, at the reading size of
// a plain MenuActionRow. A disabled row stays in the menu, focusable and greyed, so the menu keeps
// its shape (the "Use as default for" submenu's checked My documents entries,
// docs/specs/013-workspace/default-folders.md).
export function MenuCheckRow({
  label,
  icon,
  checked,
  disabled = false,
  onToggle,
}: {
  label: string;
  icon: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { itemProps } = useMenuItemProps({ disabled, checked });
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      {...itemProps}
      onClick={disabled ? undefined : onToggle}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
        disabled
          ? 'cursor-default text-slate-500 dark:text-slate-400'
          : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className="flex w-4 shrink-0 items-center justify-center text-brand-600 dark:text-brand-300"
      >
        {checked ? <CheckIcon size={12} /> : null}
      </span>
      <span
        aria-hidden
        className="flex w-5 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 [&_svg]:h-4 [&_svg]:w-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
