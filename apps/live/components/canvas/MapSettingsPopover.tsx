'use client';

import type { MapSize } from '@/lib/user-preferences';
import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';
import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';

// Settings popover for the Map panel (spec/59): a gear in the panel header
// opens a small popover, mirroring the Palette's settings popover. It holds the
// "Enable Map" toggle; turning it off hides the Map (showMinimap = false),
// which the master Settings dialog can flip back on. Shell + reset row come from
// the shared SettingsPopover so all three panel gear popovers stay in lockstep.
const SIZES: { id: MapSize; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'tall', label: 'Tall' },
];

export function MapSettingsPopover({
  enabled,
  onSetEnabled,
  dimOutside,
  onSetDimOutside,
  size,
  onSetSize,
  onResetPosition,
  resettable,
}: {
  enabled: boolean;
  onSetEnabled: (value: boolean) => void;
  dimOutside: boolean;
  onSetDimOutside: (value: boolean) => void;
  size: MapSize;
  onSetSize: (value: MapSize) => void;
  // Reset-to-default-corner lives here (not a header button) so the Map's
  // header stays a single gear; greyed out when already at the default.
  onResetPosition: () => void;
  resettable: boolean;
}) {
  return (
    <SettingsPopover
      label="Map"
      description="Options for the map panel."
      triggerAttr="data-map-settings-trigger"
      width={224}
    >
      {(close) => (
        <>
          <SettingsToggleRow
            checked={enabled}
            onToggle={() => onSetEnabled(!enabled)}
            label="Enable Map"
            hint="Turn off to hide the map; switch it back on in Settings."
          />
          <SettingsToggleRow
            checked={dimOutside}
            onToggle={() => onSetDimOutside(!dimOutside)}
            label="Dim outside the view"
            hint="Shades the rest of the board so your window stands out."
          />
          <div className="px-2 py-1.5">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">
              Map size
            </span>
            <div className="flex gap-1">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={size === s.id}
                  onClick={() => onSetSize(s.id)}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    size === s.id
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <SettingsPopoverResetRow
            onReset={onResetPosition}
            resettable={resettable}
            onClose={close}
          />
        </>
      )}
    </SettingsPopover>
  );
}
