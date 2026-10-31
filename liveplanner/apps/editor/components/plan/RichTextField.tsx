'use client';

// A card's rich text in the item panel (docs/specs/026-plan/plan-board.md "Working on a board"): the Description and
// every Long Text custom field. It reads as text until clicked (an empty one is a quiet "Add …" line); then it is the
// note editor (the same runs, toolbar and shortcuts) on a raised surface, with shortcut hints and a Saving / Saved
// line, until focus leaves it or Escape. The host saves the plain text and its runs: a moment after typing stops,
// when focus leaves, and when the panel closes. With a `maxLength`, the line beneath counts what is left from 90% of
// it, and text past it says how far over in amber and is not saved until shortened.
import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilIcon } from '@liveplanner/ui';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { TextRun } from '@liveplanner/project';
import { NoteRichTextEditor } from '@/components/notes/NoteRichTextEditor';
import { NoteRichText } from '@/components/notes/NoteRichText';

// Quiet time after the last keystroke before the text is written.
export const RICH_TEXT_SAVE_MS = 800;
// The share of `maxLength` from which the count of what is left shows.
const COUNT_FROM = 0.9;

type Status = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'over'; by: number };

export function RichTextField({
  runs,
  canEdit,
  label,
  addPrompt,
  emptyText,
  placeholder,
  maxLength,
  onSave,
}: {
  runs: TextRun[];
  canEdit: boolean;
  // The text box's name ("Description"), and its Edit button's ("Edit the description").
  label: string;
  // The empty field's invitation ("Add a description…").
  addPrompt: string;
  // What an empty field reads to someone who may only view ("No description").
  emptyText: string;
  placeholder: string;
  maxLength?: number;
  onSave: (plain: string, runs: TextRun[]) => void;
}) {
  const pending = useRef<{ plain: string; runs: TextRun[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const write = useLatest(onSave);
  // Reading until it is clicked; then the editor, until focus leaves it.
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [length, setLength] = useState(0);
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) {
      write.current(next.plain, next.runs);
      setStatus({ kind: 'saved' });
    }
  }, [write]);
  // The panel closing (or the item changing) writes what was typed.
  useEffect(() => save, [save]);

  const empty = !runs.some((r) => r.text.trim());
  const finish = () => {
    save();
    setEditing(false);
  };
  const edit = () => {
    setLength(runs.reduce((n, r) => n + r.text.length, 0));
    setEditing(true);
  };

  if (!canEdit) {
    return empty ? (
      <p className="text-[13px] text-slate-500 dark:text-slate-400">{emptyText}</p>
    ) : (
      <NoteRichText
        note={undefined}
        noteRich={runs}
        className="text-slate-700 dark:text-slate-200"
      />
    );
  }

  if (!editing && empty) {
    return (
      <button
        type="button"
        onClick={edit}
        className="group -mx-3 flex w-[calc(100%+1.5rem)] cursor-text items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
      >
        <PencilIcon size={14} />
        {addPrompt}
      </button>
    );
  }

  if (!editing) {
    // The text, its links live, and an Edit button; a click on the text (not a link) edits it too. Where the button
    // is always shown (a phone, a screen with no hover) the text keeps clear of it, and it takes a finger's tap area.
    return (
      <div
        className="group relative rounded-xl border border-transparent px-3 py-2.5 transition max-sm:pr-16 [@media(hover:none)]:pr-16 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('a, button')) edit();
        }}
      >
        <NoteRichText
          note={undefined}
          noteRich={runs}
          className="text-slate-700 dark:text-slate-200"
        />
        <button
          type="button"
          onClick={edit}
          aria-label={`Edit the ${label.toLowerCase()}`}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md touch-target bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 opacity-0 shadow-sm transition focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 [@media(hover:none)]:opacity-100 dark:bg-slate-900 dark:text-slate-400"
        >
          <PencilIcon size={11} />
          Edit
        </button>
      </div>
    );
  }

  const left = maxLength === undefined ? undefined : maxLength - length;
  const counting = maxLength !== undefined && length >= maxLength * COUNT_FROM && left! >= 0;
  return (
    <div
      className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40"
      onBlur={(e) => {
        // Focus moving within (the toolbar, the link field) keeps the editor open.
        if (e.currentTarget.contains(e.relatedTarget)) return;
        finish();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          finish();
        }
      }}
    >
      <NoteRichTextEditor
        initialRuns={runs}
        note={false}
        autoFocus
        label={label}
        placeholder={placeholder}
        surfaceClassName="min-h-40 max-h-[28rem] resize-y sm:min-h-[16rem] sm:max-h-[36rem]"
        onChange={(plain, next) => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          setLength(plain.length);
          // Past the field's limit nothing is written until it is shortened.
          if (maxLength !== undefined && plain.length > maxLength) {
            pending.current = null;
            setStatus({ kind: 'over', by: plain.length - maxLength });
            return;
          }
          pending.current = { plain, runs: next };
          setStatus({ kind: 'saving' });
          timer.current = setTimeout(save, RICH_TEXT_SAVE_MS);
        }}
        onBlur={save}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="max-sm:hidden">
          <kbd className="font-sans">⌘B</kbd> bold · <kbd className="font-sans">⌘I</kbd> italic ·
          Esc to finish
        </span>
        <span aria-live="polite" className="ml-auto flex items-center gap-2">
          {counting ? (
            <span className="tabular-nums">
              {left} character{left === 1 ? '' : 's'} left
            </span>
          ) : null}
          {status.kind === 'over' ? (
            <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
              {status.by} character{status.by === 1 ? '' : 's'} over, not saved
            </span>
          ) : status.kind === 'saving' ? (
            'Saving…'
          ) : status.kind === 'saved' ? (
            'Saved'
          ) : (
            ''
          )}
        </span>
      </div>
    </div>
  );
}
