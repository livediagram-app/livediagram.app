'use client';

import { useState } from 'react';
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
  const drawToAdd = settings.drawToAdd === true;
  const aiEnabled = settings.aiAssistanceEnabled === true;
  const minimalPanels = settings.minimalPanels === true;

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
              <CloseIcon />
            </button>
          </header>
          <div className="flex flex-col divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            <SettingsGroup title="Canvas">
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
                label="Draw shapes instead of dropping them"
                description="When on, picking a shape from the palette enters a draw mode: the cursor becomes a crosshair and you drag a rectangle on the canvas to set the shape's size. Off (the default) drops every shape at the centre of your view at a preset size."
                checked={drawToAdd}
                onChange={(v) => {
                  track('UI', 'Toggled', v ? 'DrawToAddOn' : 'DrawToAddOff');
                  onChange({ ...settings, drawToAdd: v });
                }}
              />
            </SettingsGroup>
            <SettingsGroup title="Interface">
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
            {aiCapable && (
              <SettingsGroup title="AI">
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
            <SettingsGroup title="Privacy">
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

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="flex flex-col gap-2 px-4 pb-3">{children}</div>}
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

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3l10 10M3 13l10-10" />
    </svg>
  );
}
