'use client';

// An item's description in the item panel (docs/specs/026-plan/plan-board.md "Working on a board"). It reads
// as text until clicked (an empty one is a quiet "Add a description…" line); then it is the note editor (the
// same runs, toolbar and shortcuts) on a raised surface, with shortcut hints and a Saving / Saved line,
// until focus leaves it or Escape. Saved as `descriptionRich` with `description` as its plain-text mirror,
// in one write: a moment after typing stops, when focus leaves, and when the panel closes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilIcon } from '@livediagram/ui';
import { useLatest } from '@/hooks/ui/useLatest';
import { runsFromPlainText, type TextRun } from '@livediagram/document';
import { DESCRIPTION_RICH_FIELD, type Item, type ItemPatch } from '@livediagram/items';
import { NoteRichTextEditor } from '@/components/notes/NoteRichTextEditor';
import { NoteRichText } from '@/components/notes/NoteRichText';

// Quiet time after the last keystroke before the description is written.
export const DESCRIPTION_SAVE_MS = 800;

export function descriptionRuns(item: Item): TextRun[] {
  const rich = item.fields[DESCRIPTION_RICH_FIELD];
  if (Array.isArray(rich) && rich.length > 0) return rich as unknown as TextRun[];
  const plain = item.fields['description'];
  return runsFromPlainText(typeof plain === 'string' ? plain : '');
}

// The write a description edit makes: both fields, or both cleared when it is emptied.
export function descriptionPatch(plain: string, runs: TextRun[]): ItemPatch {
  if (!plain.trim()) return { clear: ['description', DESCRIPTION_RICH_FIELD] };
  return {
    set: {
      description: plain,
      [DESCRIPTION_RICH_FIELD]: runs as unknown as Item['fields'][string],
    },
  };
}

export function ItemDescription({
  item,
  canEdit,
  onPatch,
}: {
  item: Item;
  canEdit: boolean;
  onPatch: (patch: ItemPatch) => void;
}) {
  const pending = useRef<{ plain: string; runs: TextRun[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patch = useLatest(onPatch);
  // Reading until it is clicked; then the editor, until focus leaves it.
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) {
      patch.current(descriptionPatch(next.plain, next.runs));
      setStatus('saved');
    }
  }, [patch]);
  // The panel closing (or the item changing) writes what was typed.
  useEffect(() => save, [save]);

  const runs = descriptionRuns(item);
  const empty = !runs.some((r) => r.text.trim());

  if (!canEdit) {
    return empty ? (
      <p className="text-[13px] text-slate-500">No description</p>
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
        onClick={() => setEditing(true)}
        className="group -mx-3 flex w-[calc(100%+1.5rem)] cursor-text items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
      >
        <PencilIcon size={14} />
        Add a description…
      </button>
    );
  }

  if (!editing) {
    // The text, its links live, and an Edit button; a click on the text (not a link) edits it too.
    return (
      <div
        className="group relative rounded-xl border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('a, button')) setEditing(true);
        }}
      >
        <NoteRichText
          note={undefined}
          noteRich={runs}
          className="text-slate-700 dark:text-slate-200"
        />
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit the description"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 opacity-0 shadow-sm transition focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 dark:bg-slate-900 dark:text-slate-400"
        >
          <PencilIcon size={11} />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40"
      onBlur={(e) => {
        // Focus moving within (the toolbar, the link field) keeps the editor open.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        save();
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          save();
          setEditing(false);
        }
      }}
    >
      <NoteRichTextEditor
        initialRuns={runs}
        note={false}
        autoFocus
        label="Description"
        placeholder="Write the why and the what…"
        surfaceClassName="min-h-40 max-h-[28rem] resize-y sm:min-h-[16rem] sm:max-h-[36rem]"
        onChange={(plain, next) => {
          pending.current = { plain, runs: next };
          setStatus('saving');
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, DESCRIPTION_SAVE_MS);
        }}
        onBlur={save}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="max-sm:hidden">
          <kbd className="font-sans">⌘B</kbd> bold · <kbd className="font-sans">⌘I</kbd> italic ·
          Esc to finish
        </span>
        <span aria-live="polite" className="ml-auto">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
        </span>
      </div>
    </div>
  );
}
