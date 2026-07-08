'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';

// Settings popover for the Layers panel (spec/74): a gear in the panel
// header, mirroring the Palette / Map gear popovers via the shared
// SettingsPopover shell. Holds the hover-solo preference, with the
// Reset-position row at the bottom. Desktop-only by construction: the
// gear rides MovablePanel's headerActions slot, which the mobile dock
// popover never renders — fitting, since hover doesn't exist on touch.
export function LayersSettingsPopover({
  hoverPreview,
  onSetHoverPreview,
  onResetPosition,
  resettable,
}: {
  hoverPreview: boolean;
  onSetHoverPreview: (value: boolean) => void;
  onResetPosition: () => void;
  resettable: boolean;
}) {
  return (
    <SettingsPopover
      label="Layers"
      description="Options for the Layers panel."
      triggerAttr="data-layers-settings-trigger"
      width={224}
    >
      {(close) => (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={hoverPreview}
            onClick={() => onSetHoverPreview(!hoverPreview)}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Preview layer on hover
              </span>
              <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                Resting on a row shows only that layer on the canvas.
              </span>
            </span>
            <ToggleSwitch checked={hoverPreview} label="Preview layer on hover" presentational />
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
