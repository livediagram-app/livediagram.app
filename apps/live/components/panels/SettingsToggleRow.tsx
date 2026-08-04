'use client';

import type { ReactNode } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';

// One on/off row in a settings popover: a label, a line of hint text under it,
// and a switch on the right, with the whole row as the hit target.
//
// Every settings popover in the editor had this. Three of them had already
// pulled it into a local component and given it three different names —
// SettingRow in the palette's, ToggleRow in the AI one, SettingsRow in the
// Layers one — while Map, Activity, and (despite owning one of those three)
// Layers still had rows typed out inline. Seven copies of one idea.
//
// The whole row is the button, not just the switch. That is deliberate and
// easy to lose when it is retyped: `role="switch"` plus `aria-checked` on the
// button is what makes the label, the hint and the switch one control to a
// screen reader, and the ToggleSwitch inside is `presentational` precisely so
// it does not announce itself a second time.
export function SettingsToggleRow({
  label,
  hint,
  checked,
  onToggle,
  help,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  onToggle: () => void;
  // Optional help affordance rendered BESIDE the row rather than inside it,
  // so a `?` link is never nested in the row's own interactive element.
  help?: ReactNode;
}) {
  const row = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">{hint}</span>
      </span>
      <ToggleSwitch checked={checked} label={label} presentational />
    </button>
  );
  if (!help) return row;
  return (
    <div className="flex items-center gap-1 pr-1">
      <span className="min-w-0 flex-1">{row}</span>
      {help}
    </div>
  );
}
