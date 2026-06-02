'use client';

import { useEffect } from 'react';
import { Portal } from './Portal';
import type { UserPreferences } from '@/lib/user-preferences';

// Per-user preference dialog (spec/20). Launched from the settings
// gear in the TabBar footer. Each row is a toggle bound to a single
// flag in UserPreferences; the editor owns the state and persists it
// via the user-preferences helpers. Settings travel with the user
// (device-scoped localStorage), not with the diagram, so flipping a
// flag applies the next time they open any diagram.

type SettingsDialogProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onClose: () => void;
};

export function SettingsDialog({ settings, onChange, onClose }: SettingsDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const autoRebind = settings.autoRebindArrows !== false;
  const telemetryOn = settings.telemetryEnabled !== false;

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
          className="flex w-[480px] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
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
          <div className="flex flex-col gap-3 p-4">
            <ToggleRow
              label="Auto-attach arrows when elements move"
              description="Arrows connected to a shape re-pin to whichever face reads most naturally as you drag. Turn off to keep arrow anchors fixed at whatever you chose originally."
              checked={autoRebind}
              onChange={(v) => onChange({ ...settings, autoRebindArrows: v })}
            />
            <ToggleRow
              label="Send anonymous usage events"
              description="Sends the small, first-party events listed on /telemetry (no user content, no third-party trackers) so we can see which features actually help. Turn off to keep everything you do strictly on your device."
              checked={telemetryOn}
              onChange={(v) => onChange({ ...settings, telemetryEnabled: v })}
            />
          </div>
          <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Settings are stored on this device and apply to every diagram you open.
            </p>
          </footer>
        </div>
      </div>
    </Portal>
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
