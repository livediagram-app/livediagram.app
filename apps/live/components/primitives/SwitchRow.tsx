'use client';

import type { ReactNode } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';

// A sentence that turns something on, with the house iOS-style switch at its end
// (docs/specs/004-interface-design/design-principles.md): the whole row is the control, a
// `role="switch"` button named by its words, so it is one hit target and one announcement.
// For an on/off choice inside a flow (the new-document wizard's "Always save" rows) where a
// settings row's hint line would be too much; a settings popover uses SettingsToggleRow.
export function SwitchRow({
  checked,
  onChange,
  children,
  className = '',
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
  // The caller's spacing, border and type size only.
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${className}`}
    >
      <span className="min-w-0">{children}</span>
      <ToggleSwitch checked={checked} label="" presentational />
    </button>
  );
}
