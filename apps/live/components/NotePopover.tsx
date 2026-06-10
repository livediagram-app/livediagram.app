'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal';

// Per-element note popover. Distinct from CommentThreadPopover:
// notes are a SINGLE plain-text paragraph (no author, no thread,
// no resolve / replies), surfaced as `element.note?: string` on
// the schema.
//
// Positioning mirrors CommentThreadPopover: a `data-element-id`
// lookup against the live DOM gives a screen-space rect (which
// already includes the canvas's pan + zoom transform), and the
// popover renders portaled to document.body with
// `position: fixed`. The previous implementation took canvas-
// space `bounds` from the editor state and used `position: absolute`
// on a body-portaled node, which placed the popover wherever
// `(target.x, target.y)` happened to be in viewport pixels —
// almost never where the user could see it once the canvas was
// panned or zoomed.

const WIDTH = 288; // matches the dialog's w-72 (18rem). Used for the right-edge flip.
const GAP = 12;
const EDGE_MARGIN = 8;

type NotePopoverProps = {
  // Stable element id. The popover queries the DOM for the matching
  // `[data-element-id]` wrapper rendered by BoxedElementView so the
  // popover sits in real screen-space, not canvas-space.
  elementId: string;
  // Current note text (defaults to empty if the element has none).
  initial: string;
  // Persist the next note text. Empty string + commit deletes the
  // field (see `setNote` in editor-page.tsx, which strips empties
  // before commit).
  onCommit: (next: string) => void;
  onClose: () => void;
  // Read-only viewers (view-role share participants) can open a note
  // to READ it, but not edit or delete it. In this mode the popover
  // shows the note text as static content and never commits.
  readOnly?: boolean;
};

export function NotePopover({ elementId, initial, onCommit, onClose, readOnly }: NotePopoverProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (readOnly) return;
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, [readOnly]);

  // Anchor to the element's live bounding rect. Re-runs on resize /
  // scroll so a pan or zoom keeps the popover attached. Same
  // approach as CommentThreadPopover.
  useLayoutEffect(() => {
    const update = () => {
      const node = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      // Anchor at the bottom-centre of the element, then the popover
      // shifts itself up/down via the existing `transform:
      // translate(-50%, GAP)` on the rendered div.
      let left = rect.left + rect.width / 2;
      let top = rect.bottom + GAP;
      // Clamp horizontally so a popover anchored on a near-edge
      // element doesn't run off the viewport.
      const halfW = WIDTH / 2;
      left = Math.max(halfW + EDGE_MARGIN, Math.min(left, window.innerWidth - halfW - EDGE_MARGIN));
      // Flip above the element if there's no room below.
      if (top + 220 > window.innerHeight - EDGE_MARGIN) {
        top = rect.top - GAP - 220;
      }
      top = Math.max(EDGE_MARGIN, top);
      setPos({ left, top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [elementId]);

  // Outside-click commits. Mirrors the commit-on-blur pattern the
  // rest of the editor's inline editors use; an outside click in
  // the canvas should land the user's edits rather than silently
  // discard them. Read-only viewers can't edit, so an outside click
  // just dismisses without committing.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        if (!readOnly) onCommit(value);
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCommit, onClose, value, readOnly]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd-Enter / Ctrl-Enter commits + closes. Esc cancels (revert
    // to the initial value, don't write). Plain Enter inserts a
    // newline since this is a multi-line note.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onCommit(value);
      onClose();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-50 flex w-72 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          left: pos.left,
          top: pos.top,
          transform: 'translate(-50%, 0)',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Note
        </p>
        {readOnly ? (
          <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {initial}
          </p>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKey}
              rows={5}
              placeholder="Add a note for this element…"
              className="resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Cmd-Enter saves, Esc cancels.
              </span>
              <button
                type="button"
                onClick={() => {
                  onCommit('');
                  onClose();
                }}
                disabled={!initial && !value}
                className="text-[10px] font-medium text-rose-700 transition hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:no-underline dark:text-rose-300 dark:disabled:text-slate-600"
              >
                Delete note
              </button>
            </div>
          </>
        )}
      </div>
    </Portal>
  );
}
