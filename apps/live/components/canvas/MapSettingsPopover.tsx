'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';

// Settings popover for the Map panel (spec/59): a gear in the panel header
// opens a small popover, mirroring the Palette's settings popover. It holds the
// "Enable Map" toggle; turning it off hides the Map (showMinimap = false),
// which the master Settings dialog can flip back on. Shell + reset row come from
// the shared SettingsPopover so all three panel gear popovers stay in lockstep.
export function MapSettingsPopover({
  enabled,
  onSetEnabled,
  onResetPosition,
  resettable,
}: {
  enabled: boolean;
  onSetEnabled: (value: boolean) => void;
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
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onSetEnabled(!enabled)}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Enable Map
              </span>
              <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                Turn off to hide the map; switch it back on in Settings.
              </span>
            </span>
            <ToggleSwitch checked={enabled} label="Enable Map" presentational />
          </button>
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
