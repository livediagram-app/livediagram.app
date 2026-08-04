'use client';

import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';
import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';

// Settings popover for the AI Assistant panel (spec/25), mirroring the
// Palette / Map gear popovers: turn the AI Assistant off (hides the panel; the
// Settings dialog flips it back on), toggle the suggested-prompt chips, and
// reset the panel to its default corner. Shell + reset row are shared via
// SettingsPopover.
export function AiSettingsPopover({
  enabled,
  onSetEnabled,
  showSuggestions,
  onSetShowSuggestions,
  onResetPosition,
  resettable,
}: {
  enabled: boolean;
  onSetEnabled: (value: boolean) => void;
  showSuggestions: boolean;
  onSetShowSuggestions: (value: boolean) => void;
  onResetPosition: () => void;
  resettable: boolean;
}) {
  return (
    <SettingsPopover
      label="AI"
      description="Options for the AI Assistant panel."
      triggerAttr="data-ai-settings-trigger"
      width={232}
    >
      {(close) => (
        <>
          <SettingsToggleRow
            label="AI Assistant"
            hint="Turn off to hide the panel; switch it back on in Settings."
            checked={enabled}
            onToggle={() => onSetEnabled(!enabled)}
          />
          <SettingsToggleRow
            label="Suggested prompts"
            hint="Show the quick-prompt chips under the mode tabs."
            checked={showSuggestions}
            onToggle={() => onSetShowSuggestions(!showSuggestions)}
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
