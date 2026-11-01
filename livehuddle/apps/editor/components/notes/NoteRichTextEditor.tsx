'use client';

// The note editor (docs/specs/009-elements/rich-text-notes.md): a docked toolbar over a contentEditable that
// paints the note's runs. It is the same runs ⇄ DOM machine the element-label
// editor uses (useRichTextDocument), so newlines stay literal '\n' text and
// the plain-text mirror the note stores is always the DOM's text content.
//
// Nothing is committed from here. The popover owns the note's lifecycle and
// receives the current value through `onChange`.

import { listStyleOfText } from '@/components/rich-text/block-type';
import {
  insertTextAtCaret,
  lineBeforeCaret,
  offsetsToDomRange,
  paragraphEndOffset,
  selectRange,
} from '@/components/rich-text/rich-text-dom';
import { listEnter, type TextRun } from '@livediagram/document';
import { formatShortcut } from '@/components/rich-text/rich-text-format';
import { NOTE_BASE_PX } from './note-run-style';
import { NoteFormatToolbar } from './NoteFormatToolbar';
import { useNoteRichTextSession } from './useNoteRichTextSession';

export function NoteRichTextEditor({
  initialRuns,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
}: {
  initialRuns: TextRun[];
  onChange: (plain: string, runs: TextRun[]) => void;
  // Cmd/Ctrl-Enter: commit and close.
  onSubmit?: () => void;
  // Esc: discard and close. Without it Escape is left to the host.
  onCancel?: () => void;
  // Focus left the text (after the runs are read back from it).
  onBlur?: () => void;
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
  });

  return (
    <div className="flex flex-col gap-1.5">
      <NoteFormatToolbar
        active={active}
        listStyle={listStyleOfText(liveText)}
        onToggle={onToggle}
        onApplyList={(style) => {
          applyList(style);
          // The list applies to the paragraph and leaves part of it selected; carry on typing at the end
          // of the paragraph rather than over the selection.
          requestAnimationFrame(() => {
            const root = editorRef.current;
            const end = root ? paragraphEndOffset(root) : null;
            if (root && end !== null) selectRange(offsetsToDomRange(root, end, end));
          });
        }}
        onApplyHeading={applyHeading}
        onApplyLink={applyLink}
      />
      <div
        ref={editorRef}
        data-note-surface=""
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Note"
        data-rt-placeholder="Add a note for this element…"
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
          // Cmd/Ctrl+B/I/U drive the toolbar's run toggle, never the browser's execCommand.
          const format = formatShortcut(e);
          if (format) {
            e.preventDefault();
            onToggle(format);
            return;
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
        className={`max-h-96 min-h-44 resize-y overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2 py-1.5 leading-snug text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
      />
    </div>
  );
}
