'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';

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
          <ToggleRow
            label="AI Assistant"
            description="Turn off to hide the panel; switch it back on in Settings."
            checked={enabled}
            onChange={() => onSetEnabled(!enabled)}
          />
          <ToggleRow
            label="Suggested prompts"
            description="Show the quick-prompt chips under the mode tabs."
            checked={showSuggestions}
            onChange={() => onSetShowSuggestions(!showSuggestions)}
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

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          {description}
        </span>
      </span>
      <ToggleSwitch checked={checked} label={label} presentational />
    </button>
  );
}
