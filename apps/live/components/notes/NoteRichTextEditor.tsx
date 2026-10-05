'use client';

// The note editor (docs/specs/009-elements/rich-text-notes.md): a docked toolbar over a contentEditable that
// paints the note's runs. It is the same runs ⇄ DOM machine the element-label
// editor uses (useRichTextDocument), so newlines stay literal '\n' text and
// the plain-text mirror the note stores is always the DOM's text content.
//
// Nothing is committed from here. The popover owns the note's lifecycle and
// receives the current value through `onChange`.

import { listStyleOfText } from '@/components/rich-text/block-type';
import { insertTextAtCaret, lineBeforeCaret } from '@/components/rich-text/rich-text-dom';
import { listEnter, type RunBoolKey, type TextRun } from '@livediagram/document';
import { NOTE_BASE_PX } from './note-run-style';
import { NoteFormatToolbar } from './NoteFormatToolbar';
import { useNoteRichTextSession } from './useNoteRichTextSession';

export function NoteRichTextEditor({
  initialRuns,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
  label = 'Note',
  placeholder = 'Add a note for this element…',
  surfaceClassName = 'max-h-96 min-h-44 resize-y',
  note = true,
  autoFocus,
}: {
  initialRuns: TextRun[];
  onChange: (plain: string, runs: TextRun[]) => void;
  // Cmd/Ctrl-Enter: commit and close.
  onSubmit?: () => void;
  // Esc: discard and close. Without it Escape is left to the host (the item panel closes).
  onCancel?: () => void;
  // Focus left the text (after the runs are read back from it).
  onBlur?: () => void;
  // The text box's name and empty hint, and its height; a Plan item's description sets its own.
  label?: string;
  placeholder?: string;
  surfaceClassName?: string;
  // A note: it opens focused and its formatting counts as note use. False for an item's description.
  note?: boolean;
  // Opens focused (a note always does; a description does once you choose to edit it).
  autoFocus?: boolean;
}) {
  const {
    editorRef,
    composingRef,
    active,
    liveText,
    handleInput,
    onToggle,
    applyList,
    applyHeading,
    applyLink,
  } = useNoteRichTextSession({
    initialRuns,
    onChange,
    trackFormats: note,
    autoFocus: autoFocus ?? note,
  });

  return (
    <div className="flex flex-col gap-1.5">
      <NoteFormatToolbar
        active={active}
        listStyle={listStyleOfText(liveText)}
        onToggle={onToggle}
        onApplyList={(style) => {
          applyList(style);
          // The list applies to the line and leaves part of it selected; carry on typing at the end of the
          // line rather than over the selection.
          requestAnimationFrame(() => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            sel.collapseToEnd();
            sel.modify('move', 'forward', 'lineboundary');
          });
        }}
        onApplyHeading={applyHeading}
        onApplyLink={applyLink}
        listButtons={!note}
      />
      <div
        ref={editorRef}
        data-note-surface=""
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={label}
        data-rt-placeholder={placeholder}
        style={{ fontSize: `${NOTE_BASE_PX}px` }}
        onInput={() => {
          if (composingRef.current) return;
          handleInput();
        }}
        onKeyDown={(e) => {
          // Cmd/Ctrl-Enter commits + closes; checked before the plain-Enter
          // newline branch below.
          if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
            return;
          }
          if (onCancel && e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
          }
          // Cmd/Ctrl+B/I/U must drive the SAME run-based toggle as the toolbar
          // buttons. Left to the browser, contentEditable runs its native
          // execCommand('bold'…), which wraps the DOM in <b>/<i>/<u> tags the
          // run model never sees — so the formatting vanishes on commit.
          if ((e.metaKey || e.ctrlKey) && !e.altKey) {
            const shortcut: Record<string, RunBoolKey> = {
              b: 'bold',
              i: 'italic',
              u: 'underline',
            };
            const key = shortcut[e.key.toLowerCase()];
            if (key) {
              e.preventDefault();
              onToggle(key);
              return;
            }
          }
          if (e.key === 'Enter') {
            // Insert a newline as a real '\n' text node (never <br>/<div>)
            // so it survives read-back and keeps plain-text length == DOM
            // textContent length.
            e.preventDefault();
            // A list carries on (or ends on an empty item); anything else breaks the line.
            const { insert, drop } = listEnter(lineBeforeCaret(editorRef.current));
            const sel = window.getSelection();
            for (let k = 0; k < drop; k++) sel?.modify('extend', 'backward', 'character');
            insertTextAtCaret(insert);
            handleInput();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          if (text) {
            insertTextAtCaret(text);
            handleInput();
          }
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          handleInput();
        }}
        onBlur={() => {
          // The DOM is the truth while typing; make sure the runs match it
          // whenever focus leaves (clicking the link field, say) so a commit
          // from outside the editor can't miss the last keystroke.
          handleInput();
          onBlur?.();
        }}
        className={`${surfaceClassName} overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2 py-1.5 leading-snug text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
      />
    </div>
  );
}
