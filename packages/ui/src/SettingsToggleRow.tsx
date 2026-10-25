'use client';

import type { ReactNode } from 'react';
import { SwitchRow } from './Switch';

// One on/off row in an editor's settings popover (the palette's, Layers, Map, Activity): a label, a line of hint
// text under it, and the compact switch on the right, with the whole row as the hit target.
//
// Every settings popover had this, and three editors each kept an identical copy. The whole row is the switch, not
// just the track: `role="switch"` plus `aria-checked` on the row (SwitchRow) is what makes the label, the hint and
// the switch one control to a screen reader, and the track inside is a picture, so it does not announce itself a
// second time.
export function SettingsToggleRow({
  label,
  hint,
  checked,
  onToggle,
  help,
  disabled = false,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  onToggle: () => void;
  // Optional help affordance rendered BESIDE the row rather than inside it,
  // so a `?` link is never nested in the row's own interactive element.
  help?: ReactNode;
  // The setting exists here but cannot be changed right now (a view-only
  // session, a locked tab). Shown rather than hidden: the state is still worth
  // reading, and a control that vanishes teaches nothing about why.
  disabled?: boolean;
}) {
  const row = (
    <SwitchRow
      checked={checked}
      onChange={() => onToggle()}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={`px-2 py-1.5 transition ${
        disabled ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </SwitchRow>
  );
  if (!help) return row;
  return (
    <div className="flex items-center gap-1 pr-1">
      <span className="min-w-0 flex-1">{row}</span>
      {help}
    </div>
  );
}
