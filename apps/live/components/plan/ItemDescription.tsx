'use client';

// An item's description in the item panel (docs/specs/025-plan/plan-board.md "Working on a board"): rich
// text through the note editor (the same runs, toolbar and shortcuts), saved as `descriptionRich` with
// `description` as its plain-text mirror, in one write. Saved a moment after typing stops, when focus
// leaves, and when the panel closes. Read-only, it is painted from the runs.
import { useCallback, useEffect, useRef } from 'react';
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
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) patch.current(descriptionPatch(next.plain, next.runs));
  }, [patch]);
  // The panel closing (or the item changing) writes what was typed.
  useEffect(() => save, [save]);

  if (!canEdit) {
    const runs = descriptionRuns(item);
    return runs.some((r) => r.text.trim()) ? (
      <NoteRichText
        note={undefined}
        noteRich={runs}
        className="text-slate-700 dark:text-slate-200"
      />
    ) : (
      <p className="text-[13px] text-slate-400 dark:text-slate-500">No description</p>
    );
  }
  return (
    <NoteRichTextEditor
      initialRuns={descriptionRuns(item)}
      note={false}
      label="Description"
      placeholder="Add a description…"
      surfaceClassName="min-h-40 max-h-[28rem] resize-y"
      onChange={(plain, runs) => {
        pending.current = { plain, runs };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(save, DESCRIPTION_SAVE_MS);
      }}
      onBlur={save}
    />
  );
}
