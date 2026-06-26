'use client';

import { useState, type ReactNode } from 'react';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { track } from '@/lib/telemetry';
import type { UserPreferences } from '@/lib/user-preferences';

type SettingsDialogProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onClose: () => void;
  aiCapable?: boolean;
};

export function SettingsDialog({ settings, onChange, onClose, aiCapable }: SettingsDialogProps) {
  const telemetryOn = settings.telemetryEnabled !== false;
  const aiEnabled = settings.aiAssistanceEnabled === true;
  const minimalPanels = settings.minimalPanels === true;
  const reduceMotion = settings.reduceMotion === true;
  const notificationsOn = settings.notificationsEnabled !== false;

  // Single-open accordion: the title of the one expanded group (or null).
  // Opening one collapses the rest. Starts on Interface so the dialog lands
  // with a section showing (the Canvas group's toggles moved to the Palette
  // settings popover — see spec/20).
  const [openGroup, setOpenGroup] = useState<string | null>('Interface');
  const groupProps = (title: string) => ({
    title,
    open: openGroup === title,
    onToggle: () => setOpenGroup((g) => (g === title ? null : title)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Settings"
      size="md"
      className="max-h-[calc(100%-2rem)]"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <CloseIcon size={16} strokeWidth={1.6} />
        </button>
      </header>
      <div className="flex flex-col divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        <SettingsGroup {...groupProps('Interface')}>
          <ToggleRow
            label="Minimal panel layout"
            description="Replaces the floating Explorer, Palette, Editor, and AI panels with a compact button bar that opens each as a popover. Keeps the canvas uncluttered when you want more room to work. Always active on mobile regardless of this setting."
            checked={minimalPanels}
            onChange={(v) => {
              track('UI', 'Toggled', v ? 'MinimalPanelsOn' : 'MinimalPanelsOff');
              onChange({ ...settings, minimalPanels: v });
            }}
            help={
              <HelpArticleLink
                article="minimalPanels"
                variant="text"
                title="Minimal panels"
                description="How the compact button bar works."
              />
            }
          />
          <ToggleRow
            label="Show minimap"
            description="Shows a small overview of the whole canvas in the bottom-left corner once a tab has a few elements and the Activity panel is minimised. Tap or drag it to jump around; scroll on it to zoom. Desktop only."
            checked={settings.showMinimap !== false}
            onChange={(v) => {
              track('UI', 'Toggled', v ? 'MinimapOn' : 'MinimapOff');
              onChange({ ...settings, showMinimap: v });
            }}
          />
        </SettingsGroup>
        <SettingsGroup {...groupProps('Notifications')}>
          <ToggleRow
            label="Show notifications"
            description="Shows a brief confirmation when you do something whose result isn't on screen, like moving a diagram to a folder or linking a tab. Errors are always shown so a failure is never hidden. Turn off for a quieter editor."
            checked={notificationsOn}
            onChange={(v) => {
              track('UI', 'Toggled', v ? 'NotificationsOn' : 'NotificationsOff');
              onChange({ ...settings, notificationsEnabled: v });
            }}
          />
        </SettingsGroup>
        <SettingsGroup {...groupProps('Accessibility')}>
          <ToggleRow
            label="Reduce motion"
            description="Turns off the editor's decorative animations and transitions (panels, popovers, the snap guides, etc.) so the interface appears instantly instead of sliding or popping. Your device's own 'reduce motion' setting is always respected; this lets you force it on here too, and it syncs across your devices."
            checked={reduceMotion}
            onChange={(v) => {
              track('UI', 'Toggled', v ? 'ReduceMotionOn' : 'ReduceMotionOff');
              onChange({ ...settings, reduceMotion: v });
            }}
          />
        </SettingsGroup>
        {aiCapable && (
          <SettingsGroup {...groupProps('AI')}>
            <ToggleRow
              label="AI Assistant"
              description="Shows an AI panel in the editor. Use it to generate new elements, amend or clean existing ones, or get a written review of your diagram. Off by default."
              checked={aiEnabled}
              onChange={(v) => {
                track('AI', 'Toggled', v ? 'AiOn' : 'AiOff');
                onChange({ ...settings, aiAssistanceEnabled: v });
              }}
              help={
                <HelpArticleLink
                  article="aiTools"
                  variant="text"
                  title="AI tools"
                  description="What the Build, Ask, Review, and Clean modes do."
                />
              }
            />
          </SettingsGroup>
        )}
        <SettingsGroup {...groupProps('Privacy')}>
          <ToggleRow
            label="Send anonymous usage events"
            description="Sends the small, first-party events listed on /telemetry (no user content, no third-party trackers) so we can see which features actually help. Turn off to keep everything you do strictly on your device."
            checked={telemetryOn}
            onChange={(v) => {
              track('UI', 'Toggled', v ? 'TelemetryOn' : 'TelemetryOff');
              onChange({ ...settings, telemetryEnabled: v });
            }}
            help={
              <HelpArticleLink
                article="whatWeCollect"
                variant="text"
                title="What we collect"
                description="Exactly which anonymous events are sent, and what isn't."
              />
            }
          />
        </SettingsGroup>
      </div>
      <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          Settings sync to your account and apply to every diagram you open, on every device you
          sign in from.
        </p>
      </footer>
    </Dialog>
  );
}

function SettingsGroup({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  // Controlled by the dialog so only one group is open at a time.
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <ChevronIcon open={open} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 px-4 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  help,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  // Optional "Learn more" link. Rendered INSIDE the setting card (indented
  // under the label) so it's clearly tied to this setting, but outside the
  // <label> so clicking it doesn't toggle the checkbox.
  help?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span>
          <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {description}
          </span>
        </span>
      </label>
      {/* Aligned under the label text (checkbox 1rem + gap 0.75rem = pl-7). */}
      {help ? <div className="pl-7">{help}</div> : null}
    </div>
  );
}
