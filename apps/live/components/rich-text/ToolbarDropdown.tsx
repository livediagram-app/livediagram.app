'use client';

// A compact dropdown for the rich-text toolbars, kept INLINE (not portalled)
// so it stays inside the toolbar wrapper, where the editor's focus +
// canvas-propagation guards already apply. Closes on an option click (the
// menu's bubble handler) or an outside pointerdown (capture phase, so it fires
// before the wrapper stops propagation). The trigger preventDefaults mousedown
// so the editor keeps its selection while the menu is open.
//
// Shared by the label toolbar (RichTextToolbar) and the note toolbar
// (NoteFormatToolbar) — they host the same block-type picker (spec/102) and a
// second copy of this would drift on the first behaviour fix.

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug).
export const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

const CHEVRON = (
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
  >
    <path d="M3 4.5 6 7.5 9 4.5" />
  </svg>
);

export function ToolbarDropdown({
  label,
  description,
  trigger,
  menuClassName = 'min-w-[8rem]',
  hideChevron = false,
  children,
}: {
  label: string;
  description: string;
  trigger: React.ReactNode;
  menuClassName?: string;
  hideChevron?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);
  return (
    <div className="relative" ref={rootRef}>
      <Tooltip title={label} description={description}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onMouseDown={noFocusSteal}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-8 items-center gap-0.5 rounded-md px-1.5 transition ${
            open
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          {trigger}
          {hideChevron ? null : CHEVRON}
        </button>
      </Tooltip>
      {open ? (
        <div
          role="listbox"
          // An option click bubbles here and closes the menu after its own
          // handler runs.
          onClick={() => setOpen(false)}
          className={`absolute left-0 top-full z-[var(--z-panel)] mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
