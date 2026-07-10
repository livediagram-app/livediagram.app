'use client';

import { useState } from 'react';
import { useEscape } from '@/hooks/ui/useEscape';
import { Dialog } from '@/components/dialogs/Dialog';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

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
      { keys: ['⌘', 'X'], label: 'Cut selection' },
      { keys: ['⌘', 'C'], label: 'Copy selection' },
      { keys: ['⌘', 'V'], label: 'Paste (offset copy)' },
      { keys: ['⌘', 'D'], label: 'Duplicate selection' },
      { keys: ['⌘', 'G'], label: 'Group selection  /  Ungroup' },
      { keys: ['⌘', '⇧', 'L'], label: 'Lock  /  Unlock selection' },
      { keys: ['⌘', 'A'], label: 'Select all' },
      { keys: ['Del', '/  ⌫'], label: 'Delete selection' },
      { keys: ['⌘', '⇧', ']'], label: 'Bring to front' },
      { keys: ['⌘', '⇧', '['], label: 'Send to back' },
    ],
  },
  {
    heading: 'Tools',
    rows: [
      { keys: ['V'], label: 'Select tool  (or S)' },
      { keys: ['H'], label: 'Hand tool' },
      { keys: ['K'], label: 'Laser pointer' },
      { keys: ['E'], label: 'Eraser (click / drag to delete)' },
      { keys: ['P'], label: 'Pencil (freehand)' },
      { keys: ['I'], label: 'Isometric view' },
      { keys: ['⇧', 'drag'], label: 'Rotate isometric camera' },
      { keys: ['Z'], label: 'Zen mode (focus)' },
    ],
  },
  {
    heading: 'Add elements',
    rows: [
      { keys: ['R'], label: 'Rectangle' },
      { keys: ['O'], label: 'Oval' },
      { keys: ['D'], label: 'Diamond' },
      { keys: ['C'], label: 'Cylinder' },
      { keys: ['G'], label: 'Parallelogram' },
      { keys: ['T'], label: 'Text' },
      { keys: ['N'], label: 'Note (sticky)' },
      { keys: ['A'], label: 'Arrow' },
      { keys: ['F'], label: 'Frame' },
      { keys: ['9'], label: 'Image picker' },
      { keys: ['1', '–', '0'], label: 'Number row also picks tools / shapes' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search & commands  (or ⌘ .)' },
      { keys: ['⌘', '+'], label: 'Zoom in' },
      { keys: ['⌘', '-'], label: 'Zoom out' },
      { keys: ['⌘', '0'], label: 'Reset zoom to 100%' },
      { keys: ['⇧', '1'], label: 'Zoom to fit' },
      { keys: ['Tab'], label: 'Select next element  (Shift: previous)' },
      { keys: ['Arrow'], label: 'Nudge selection 1 px  (Shift: 10 px)' },
      { keys: ['Shift', 'Click'], label: 'Toggle element in multi-selection' },
      { keys: ['Shift', 'drag'], label: 'Drop a duplicate (original stays put)' },
      { keys: ['Space', 'drag'], label: 'Pan canvas (overrides current tool)' },
      { keys: ['Space'], label: 'Edit label of selected element' },
      { keys: ['Type'], label: 'Replace label of selected element' },
      { keys: ['Escape'], label: 'Cancel current mode, or clear selection' },
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

  // Single-open accordion: the heading of the one expanded section (or
  // null when all are collapsed). Opening one collapses the rest. Starts
  // on the first section so the dialog lands with one group showing.
  const [openHeading, setOpenHeading] = useState<string | null>(SECTIONS[0]?.heading ?? null);

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Keyboard shortcuts"
      size="md"
      closeOnEscape={false}
      className="max-h-[90vh] dark:text-slate-100"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Keyboard shortcuts
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ⌘ = Cmd on Mac, Ctrl on Windows / Linux
          </p>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="keyboardShortcuts"
            title="Keyboard shortcuts"
            description="The full shortcut reference and tips for faster editing."
            className="!h-7 !w-7 !rounded !border-0 !text-sm !text-slate-400 hover:!bg-slate-100 hover:!text-slate-700 dark:!text-slate-400 dark:hover:!bg-slate-800 dark:hover:!text-slate-200"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-5 py-1 dark:divide-slate-800">
        {SECTIONS.map((section) => (
          // Each section is a collapsible accordion. One open at a time:
          // opening a group collapses whichever was open, so the (long)
          // list stays compact.
          <ShortcutSection
            key={section.heading}
            section={section}
            open={openHeading === section.heading}
            onToggle={() => setOpenHeading((h) => (h === section.heading ? null : section.heading))}
          />
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
    </Dialog>
  );
}

function ShortcutSection({
  section,
  open,
  onToggle,
}: {
  section: ShortcutSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
          {section.heading}
        </span>
        <ChevronIcon open={open} className="text-slate-400 dark:text-slate-400" />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col divide-y divide-slate-100 pb-2 dark:divide-slate-800">
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
      </div>
    </div>
  );
}
