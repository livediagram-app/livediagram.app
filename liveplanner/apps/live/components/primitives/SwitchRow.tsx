'use client';

import type { ReactNode } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';

// A sentence that turns something on, with the house iOS-style switch at its end
// (docs/specs/004-interface-design/design-principles.md): the whole row is the control, a
// `role="switch"` button named by its words, so it is one hit target and one announcement.
// For an on/off choice inside a flow (the new-project wizard's "Always save" rows) where a
// settings row's hint line would be too much; a settings popover uses SettingsToggleRow.
export function SwitchRow({
  checked,
  onChange,
  children,
  className = '',
  disabled = false,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
  // The caller's spacing, border and type size only.
  className?: string;
  // Can't be flipped now; the caller says why beside it.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span className="min-w-0">{children}</span>
      <ToggleSwitch checked={checked} label="" presentational />
    </button>
  );
}
