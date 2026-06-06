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

type ShortcutSection = {
  heading: string;
  rows: ShortcutRow[];
};

const SECTIONS: ShortcutSection[] = [
  {
    heading: 'Edit',
    rows: [
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo  (or Ctrl Y)' },
      { keys: ['⌘', 'C'], label: 'Copy selection' },
      { keys: ['⌘', 'V'], label: 'Paste (offset copy)' },
      { keys: ['⌘', 'G'], label: 'Group selection  /  Ungroup' },
      { keys: ['⌘', 'L'], label: 'Lock  /  Unlock selection' },
      { keys: ['⌘', 'A'], label: 'Select all' },
      { keys: ['Del', '/  ⌫'], label: 'Delete selection' },
      { keys: ['⌘', '+'], label: 'Zoom in' },
      { keys: ['⌘', '-'], label: 'Zoom out' },
      { keys: ['⌘', '0'], label: 'Reset zoom to 100%' },
    ],
  },
  {
    heading: 'Tools',
    rows: [
      { keys: ['S'], label: 'Select tool' },
      { keys: ['P'], label: 'Pan tool' },
      { keys: ['L'], label: 'Laser pointer' },
      { keys: ['F'], label: 'Pencil (freehand)' },
    ],
  },
  {
    heading: 'Add elements',
    rows: [
      { keys: ['R'], label: 'Rectangle' },
      { keys: ['O'], label: 'Oval' },
      { keys: ['D'], label: 'Diamond' },
      { keys: ['T'], label: 'Text' },
      { keys: ['N'], label: 'Note (sticky)' },
      { keys: ['A'], label: 'Arrow' },
      { keys: ['I'], label: 'Image picker' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
      { keys: ['Arrow'], label: 'Nudge selection 1 px  (Shift: 10 px)' },
      { keys: ['Shift', 'Click'], label: 'Toggle element in multi-selection' },
      { keys: ['Space', 'drag'], label: 'Pan canvas (overrides current tool)' },
      { keys: ['Space'], label: 'Edit label of selected element' },
      { keys: ['Type'], label: 'Replace label of selected element' },
      { keys: ['Escape'], label: 'Cancel format painter or group mode' },
      { keys: ['⌘', 'hold'], label: 'Show shortcut badges on palette' },
    ],
  },
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
      onClick={(e) => {
        // Click-to-close on the backdrop, matching the Search + Settings
        // dialogs (only when the click lands on the backdrop itself).
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div className="pointer-events-auto flex w-[30rem] max-w-[92%] max-h-[90vh] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ⌘ = Cmd on Mac, Ctrl on Windows / Linux
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {SECTIONS.map((section, si) => (
            <div key={section.heading} className={si > 0 ? 'mt-4' : undefined}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.heading}
              </p>
              <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {section.rows.map((s) => (
                  <li
                    key={s.keys.join('+')}
                    className="flex items-center justify-between gap-3 py-1.5 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
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
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
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
