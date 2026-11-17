'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampIntoRange, Portal } from '@livediagram/ui';
import type { TextRun } from '@livediagram/document';
import { NoteRichText, noteRuns } from '@/components/notes/NoteRichText';
import { NoteRichTextEditor } from '@/components/notes/NoteRichTextEditor';
import { VIEWPORT_EDGE_MARGIN as EDGE_MARGIN } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// Per-element note popover. Distinct from CommentThreadPopover: notes are a
// SINGLE small document (no author, no thread, no resolve / replies),
// surfaced as `element.note?` plus its formatting runs `element.noteRich?`
// on the schema. Rich text (bold / italic / underline, headings, bullet +
// numbered lists, links) landed in docs/specs/009-elements/rich-text-notes.md; the editing surface itself is
// NoteRichTextEditor, this file is the anchored shell around it.
//
// Positioning mirrors CommentThreadPopover: a `data-element-id` lookup
// against the live DOM gives a screen-space rect (which already includes the
// canvas's pan + zoom transform), and the popover renders portaled to
// document.body with `position: fixed`. The previous implementation took
// canvas-space `bounds` from the editor state and used `position: absolute`
// on a body-portaled node, which placed the popover wherever `(target.x,
// target.y)` happened to be in viewport pixels — almost never where the user
// could see it once the canvas was panned or zoomed.

// 26rem, the popover's width wherever it fits. On a phone it is capped at the viewport less both edge margins (374px
// at 390px wide), so it stays wholly on screen (docs/specs/009-elements/rich-text-notes.md "The popover").
const WIDTH = 416;
// Rough popover height, used only to decide whether to flip above the
// element. Generous: toolbar + an 11rem editor + the footer row.
const APPROX_HEIGHT = 320;
const GAP = 12;

// Where the popover sits and how wide it draws: anchored at the element's bottom-centre (the rendered div shifts
// itself left by half its width), flipped above the element when there is no room below, and clamped so the whole
// width stays inside the viewport's edge margins.
export function notePopoverBox(
  rect: Pick<DOMRect, 'left' | 'top' | 'bottom' | 'width'>,
  viewport: { width: number; height: number },
): { left: number; top: number; width: number } {
  const width = Math.max(0, Math.min(WIDTH, viewport.width - EDGE_MARGIN * 2));
  const halfW = width / 2;
  const left = clampIntoRange(
    rect.left + rect.width / 2,
    halfW + EDGE_MARGIN,
    viewport.width - halfW - EDGE_MARGIN,
  );
  let top = rect.bottom + GAP;
  if (top + APPROX_HEIGHT > viewport.height - EDGE_MARGIN) top = rect.top - GAP - APPROX_HEIGHT;
  return { left, top: Math.max(EDGE_MARGIN, top), width };
}

type NotePopoverProps = {
  // Stable element id. The popover queries the DOM for the matching
  // `[data-element-id]` wrapper rendered by BoxedElementView so the
  // popover sits in real screen-space, not canvas-space.
  elementId: string;
  // Current note text (defaults to empty if the element has none).
  initial: string;
  // Current note formatting, when the note carries any.
  initialRuns?: TextRun[];
  // Persist the next note. Empty text + commit deletes the fields (see
  // `setNote` in useEditorNotes.ts, which strips empties before commit).
  onCommit: (next: string, runs: TextRun[]) => void;
  onClose: () => void;
  // Read-only viewers (view-role share participants) can open a note
  // to READ it, but not edit or delete it. In this mode the popover
  // shows the formatted note as static content and never commits.
  readOnly?: boolean;
};

export function NotePopover({
  elementId,
  initial,
  initialRuns,
  onCommit,
  onClose,
  readOnly,
}: NotePopoverProps) {
  // The live value, kept in step by the editor's onChange so an outside
  // click can commit without reaching into the contentEditable.
  const valueRef = useRef<{ plain: string; runs: TextRun[] }>({
    plain: initial,
    runs: noteRuns(initial, initialRuns),
  });
  // Only drives the Delete-note button's disabled state; the editor itself
  // is uncontrolled (it paints its own DOM), so this never fights it.
  const [hasText, setHasText] = useState(initial.trim().length > 0);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  // Anchor to the element's live bounding rect. Re-runs on resize /
  // scroll so a pan or zoom keeps the popover attached. Same
  // approach as CommentThreadPopover.
  useLayoutEffect(() => {
    const update = () => {
      const node = document.querySelector(elementSelector(elementId));
      if (!node) return;
      setPos(
        notePopoverBox(node.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      );
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
        if (!readOnly) onCommit(valueRef.current.plain, valueRef.current.runs);
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCommit, onClose, readOnly]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-modal)] flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          left: pos.left,
          top: pos.top,
          width: pos.width,
          transform: 'translate(-50%, 0)',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Note
        </p>
        {readOnly ? (
          <NoteRichText
            note={initial}
            noteRich={initialRuns}
            className="max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <>
            <NoteRichTextEditor
              initialRuns={noteRuns(initial, initialRuns)}
              onChange={(plain, runs) => {
                valueRef.current = { plain, runs };
                setHasText(plain.trim().length > 0);
              }}
              onSubmit={() => {
                onCommit(valueRef.current.plain, valueRef.current.runs);
                onClose();
              }}
              onCancel={onClose}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Cmd-Enter saves, Esc cancels.
              </span>
              <button
                type="button"
                onClick={() => {
                  onCommit('', []);
                  onClose();
                }}
                disabled={!initial && !hasText}
                className="text-[10px] font-medium text-slate-500 transition hover:text-slate-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:no-underline dark:text-slate-400 dark:hover:text-slate-200 dark:disabled:text-slate-600"
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
