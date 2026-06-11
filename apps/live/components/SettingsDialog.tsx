'use client';

import { useState } from 'react';
import { CloseIcon } from './CloseIcon';
import { Portal } from './Portal';
import { useEscape } from '@/hooks/useEscape';
import { track } from '@/lib/telemetry';
import type { UserPreferences } from '@/lib/user-preferences';

type SettingsDialogProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onClose: () => void;
  aiCapable?: boolean;
};

export function SettingsDialog({ settings, onChange, onClose, aiCapable }: SettingsDialogProps) {
  useEscape(onClose);

  const autoRebind = settings.autoRebindArrows !== false;
  const telemetryOn = settings.telemetryEnabled !== false;
  const aiEnabled = settings.aiAssistanceEnabled === true;
  const minimalPanels = settings.minimalPanels === true;
  const alignmentGuides = settings.alignmentGuides !== false;
  const reduceMotion = settings.reduceMotion === true;
  const notificationsOn = settings.notificationsEnabled !== false;

  // Single-open accordion: the title of the one expanded group (or null).
  // Opening one collapses the rest. Starts on Canvas so the dialog lands
  // with a section showing.
  const [openGroup, setOpenGroup] = useState<string | null>('Canvas');
  const groupProps = (title: string) => ({
    title,
    open: openGroup === title,
    onToggle: () => setOpenGroup((g) => (g === title ? null : title)),
  });

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          className="flex max-h-[calc(100%-2rem)] w-[480px] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
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
            <SettingsGroup {...groupProps('Canvas')}>
              <ToggleRow
                label="Auto-attach arrows when elements move"
                description="Arrows connected to a shape re-pin to whichever face reads most naturally as you drag. Turn off to keep arrow anchors fixed at whatever you chose originally."
                checked={autoRebind}
                onChange={(v) => {
                  track('UI', 'Toggled', v ? 'AutoRebindOn' : 'AutoRebindOff');
                  onChange({ ...settings, autoRebindArrows: v });
                }}
              />
              <ToggleRow
                label="Show alignment guides"
                description="Draws faint lines along the edges and centres a shape shares with its neighbours as you move or resize it, so you can see why it snapped and line things up on a busy canvas. The snap still happens either way; turn this off for a bare canvas."
                checked={alignmentGuides}
                onChange={(v) => {
                  track('UI', 'Toggled', v ? 'AlignmentGuidesOn' : 'AlignmentGuidesOff');
                  onChange({ ...settings, alignmentGuides: v });
                }}
              />
            </SettingsGroup>
            <SettingsGroup {...groupProps('Interface')}>
              <ToggleRow
                label="Minimal panel layout"
                description="Replaces the floating Explorer, Palette, Editor, and AI panels with a compact button bar that opens each as a popover. Keeps the canvas uncluttered when you want more room to work. Always active on mobile regardless of this setting."
                checked={minimalPanels}
                onChange={(v) => {
                  track('UI', 'Toggled', v ? 'MinimalPanelsOn' : 'MinimalPanelsOff');
                  onChange({ ...settings, minimalPanels: v });
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
              />
            </SettingsGroup>
          </div>
          <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Settings sync to your account and apply to every diagram you open, on every device you
              sign in from.
            </p>
          </footer>
        </div>
      </div>
    </Portal>
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
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60">
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
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}
