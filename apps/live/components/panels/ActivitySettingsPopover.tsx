'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';

// Settings popover for the Activity panel (spec/12): a gear in the
// panel header, mirroring the Layers / Palette gear popovers via the
// shared SettingsPopover shell. Holds the revert hover-preview
// preference, with the Reset-position row at the bottom. Desktop-only
// by construction: the gear rides MovablePanel's headerActions slot,
// which the mobile dock popover never renders — fitting, since hover
// doesn't exist on touch.
export function ActivitySettingsPopover({
  revertHoverPreview,
  onSetRevertHoverPreview,
  onResetPosition,
  resettable,
}: {
  revertHoverPreview: boolean;
  onSetRevertHoverPreview: (value: boolean) => void;
  onResetPosition: () => void;
  resettable: boolean;
}) {
  return (
    <SettingsPopover
      label="Activity"
      description="Options for the Activity panel."
      triggerAttr="data-activity-settings-trigger"
      width={224}
    >
      {(close) => (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={revertHoverPreview}
            onClick={() => onSetRevertHoverPreview(!revertHoverPreview)}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Preview revert on hover
              </span>
              <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                Resting on an entry shows what its Revert would do.
              </span>
            </span>
            <ToggleSwitch
              checked={revertHoverPreview}
              label="Preview revert on hover"
              presentational
            />
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
