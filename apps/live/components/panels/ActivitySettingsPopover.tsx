'use client';

import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';
import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';

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
          <SettingsToggleRow
            checked={revertHoverPreview}
            onToggle={() => onSetRevertHoverPreview(!revertHoverPreview)}
            label="Preview revert on hover"
            hint="Resting on an entry shows what its Revert would do."
          />
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
