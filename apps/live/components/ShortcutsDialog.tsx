'use client';

import { useEscape } from '@/hooks/useEscape';

// Keyboard shortcut catalogue + per-device disable toggle. The
// modal lists every shortcut the editor binds today and lets the
// user opt out entirely. The disable flag lives in localStorage
// (per-browser) so a user with a tablet + external keyboard can
// keep them on while a screen-reader user can flip them off.

type ShortcutRow = {
  keys: string[];
  label: string;
};

// Single source of truth for "what shortcuts does the editor have"
// today. Edit this list when adding / removing a shortcut so the
// modal and the binding stay aligned. Mac convention: ⌘ for the
// meta key (the bindings accept ctrlKey too, so the same row
// reads naturally for Linux / Windows users via the supplementary
// label).
const SHORTCUTS: ShortcutRow[] = [
  { keys: ['⌘', 'Z'], label: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], label: 'Redo (or Ctrl-Y)' },
  { keys: ['Delete'], label: 'Delete the current selection' },
  { keys: ['Backspace'], label: 'Delete the current selection' },
  { keys: ['Escape'], label: 'Cancel format painter or group mode' },
  { keys: ['Shift', 'Click'], label: 'Toggle an element in the multi-selection' },
  { keys: ['Space', 'drag'], label: 'Pan the canvas (overrides the current tool)' },
];

type ShortcutsDialogProps = {
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  onClose: () => void;
};

export function ShortcutsDialog({ enabled, onToggleEnabled, onClose }: ShortcutsDialogProps) {
  // Esc closes. Capture phase + stopPropagation so the modal wins
  // against the editor's global shortcuts at document bubble even
  // when those are disabled.
  useEscape(onClose, { capture: true, stopPropagation: true });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto flex w-[28rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Keyboard shortcuts
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Quick keys the editor binds globally. The toggle below is per-device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 py-2 text-xs">
              <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${k}-${i}`}
                    className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Keyboard shortcuts
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Enabled on this device. Disable to use system shortcuts only.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggleEnabled(!enabled)}
            className={
              enabled
                ? 'relative h-5 w-9 shrink-0 rounded-full bg-brand-500 transition'
                : 'relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition dark:bg-slate-700'
            }
          >
            <span
              aria-hidden
              className={
                enabled
                  ? 'absolute left-[18px] top-[2px] h-4 w-4 rounded-full bg-white shadow transition'
                  : 'absolute left-[2px] top-[2px] h-4 w-4 rounded-full bg-white shadow transition'
              }
            />
          </button>
        </div>
      </div>
    </div>
  );
}
