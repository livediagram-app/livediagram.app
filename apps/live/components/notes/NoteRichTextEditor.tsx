'use client';

// The note editor (spec/92): a docked toolbar over a contentEditable that
// paints the note's runs. It is the same runs ⇄ DOM machine the element-label
// editor uses (useRichTextDocument), so newlines stay literal '\n' text and
// the plain-text mirror the note stores is always the DOM's text content.
//
// Nothing is committed from here. The popover owns the note's lifecycle and
// receives the current value through `onChange`.

import { insertTextAtCaret } from '@/components/rich-text/rich-text-dom';
import type { RunBoolKey, TextRun } from '@livediagram/diagram';
import { NOTE_BASE_PX } from './note-run-style';
import { NoteFormatToolbar } from './NoteFormatToolbar';
import { useNoteRichTextSession } from './useNoteRichTextSession';

export function NoteRichTextEditor({
  initialRuns,
  onChange,
  onSubmit,
  onCancel,
}: {
  initialRuns: TextRun[];
  onChange: (plain: string, runs: TextRun[]) => void;
  // Cmd/Ctrl-Enter: commit and close.
  onSubmit: () => void;
  // Esc: discard and close.
  onCancel: () => void;
}) {
  const {
    editorRef,
    composingRef,
    active,
    handleInput,
    onToggle,
    applyList,
    applyHeading,
    applyLink,
  } = useNoteRichTextSession({ initialRuns, onChange });

  return (
    <div className="flex flex-col gap-1.5">
      <NoteFormatToolbar
        active={active}
        onToggle={onToggle}
        onApplyList={applyList}
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
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
            return;
          }
          if (e.key === 'Escape') {
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
            insertTextAtCaret('\n');
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
        }}
        className="max-h-96 min-h-44 resize-y overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2 py-1.5 leading-snug text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}
