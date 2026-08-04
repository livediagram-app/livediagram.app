'use client';

import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';
import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';

// Settings popover for the Layers panel (spec/74): a gear in the panel
// header, mirroring the Palette / Map gear popovers via the shared
// SettingsPopover shell. Holds the hover-solo preference, with the
// Reset-position row at the bottom. Desktop-only by construction: the
// gear rides MovablePanel's headerActions slot, which the mobile dock
// popover never renders — fitting, since hover doesn't exist on touch.
export function LayersSettingsPopover({
  hoverPreview,
  onSetHoverPreview,
  showPreview,
  onSetShowPreview,
  showCount,
  onSetShowCount,
  onResetPosition,
  resettable,
}: {
  hoverPreview: boolean;
  onSetHoverPreview: (value: boolean) => void;
  // Row density options (spec/74).
  showPreview: boolean;
  onSetShowPreview: (value: boolean) => void;
  showCount: boolean;
  onSetShowCount: (value: boolean) => void;
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
          <SettingsToggleRow
            checked={hoverPreview}
            onToggle={() => onSetHoverPreview(!hoverPreview)}
            label="Preview layer on hover"
            hint="Resting on a row shows only that layer on the canvas."
          />
          <SettingsToggleRow
            checked={showPreview}
            onToggle={() => onSetShowPreview(!showPreview)}
            label="Show layer thumbnails"
            hint="The quickest way to tell two similar layers apart; off gives a compact list."
          />
          <SettingsToggleRow
            checked={showCount}
            onToggle={() => onSetShowCount(!showCount)}
            label="Show element counts"
            hint="How many elements each layer holds, beside its name."
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

// The switch row this popover repeats. Local rather than shared: the three
// gear popovers each have their own copy today, and extracting one primitive
// across them is a change to make deliberately, not as a side effect here.
