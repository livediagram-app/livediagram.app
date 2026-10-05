'use client';

// Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the map edited as a list of
// rows, one per node with a level instead of typed spaces (MindOutlineRows). A quiet count says
// what Save will do and, when Save would remove nodes, a question comes first: Keep Editing or
// Remove. ⌘/Ctrl+Enter saves; Escape cancels (the Dialog's own). On a phone it rises as a sheet.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@livediagram/ui';
import type { MindOutlineSummary } from '@livediagram/document';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { rowsFromText, rowText, textFromRows, type OutlineRow } from '@/lib/outline-rows';
import { DialogHeader } from './DialogHeader';
import { MindOutlineRows } from './MindOutlineRows';

// Removed nodes the question names before "and N more".
const NAMED_REMOVALS = 3;

function countLine(s: MindOutlineSummary): string {
  const parts = [
    s.added ? `${s.added} added` : '',
    s.renamed ? `${s.renamed} renamed` : '',
    s.restyled ? `${s.restyled} restyled` : '',
    s.moved ? `${s.moved} moved` : '',
    s.removed.length ? `${s.removed.length} removed` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
}

function RemoveQuestion({
  removed,
  onKeep,
  onRemove,
}: {
  removed: { label?: string }[];
  onKeep: () => void;
  onRemove: () => void;
}): ReactNode {
  const one = removed.length === 1;
  const names = removed
    .slice(0, NAMED_REMOVALS)
    .map((n) => `“${(n.label ?? '').trim().replace(/\s*\n\s*/g, ' ') || 'Untitled'}”`)
    .join(', ');
  const more = removed.length - NAMED_REMOVALS;
  return (
    <div
      role="alertdialog"
      aria-label={`Remove ${removed.length} ${one ? 'node' : 'nodes'}?`}
      className="rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30"
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Remove {removed.length} {one ? 'node' : 'nodes'}?
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        {names}
        {more > 0 ? ` and ${more} more` : ''} will go, with {one ? 'its' : 'their'} connectors. Undo
        brings them back.
      </p>
      <div className="mt-2.5 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onKeep}>
          Keep Editing
        </Button>
        <Button size="sm" variant="danger" autoFocus onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function MindOutlineDialog({
  initialText,
  summarise,
  onSave,
  onClose,
}: {
  initialText: string;
  // What saving `text` would do to the map.
  summarise: (text: string) => MindOutlineSummary | null;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<OutlineRow[]>(() => rowsFromText(initialText));
  const [confirming, setConfirming] = useState(false);
  // The outline as Save reads it.
  const text = useMemo(() => textFromRows(rows), [rows]);
  // A root row with no text has nothing to save onto the root.
  const empty = rowText(rows[0]!).trim() === '';
  const summary = useMemo(() => (empty ? null : summarise(text)), [text, empty, summarise]);

  // An edit takes back a pending removal question.
  const onRows = useCallback((next: OutlineRow[]) => {
    setRows(next);
    setConfirming(false);
  }, []);

  const save = () => {
    if (!summary) return;
    if (summary.removed.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(text);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Edit Outline"
      size="lg"
      phoneSheet
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Edit Outline"
        subtitle="One row per node. Tab nests a row under the one above; Shift+Enter adds a line."
      >
        <div className="flex shrink-0 items-center gap-1">
          <HelpArticleLink article="mindMapOutline" />
          <DialogCloseButton onClick={onClose} />
        </div>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-2 px-6 py-4 max-sm:px-4">
        <MindOutlineRows rows={rows} onRows={onRows} onSave={save} />
        {confirming && summary ? (
          <RemoveQuestion
            removed={summary.removed}
            onKeep={() => setConfirming(false)}
            onRemove={save}
          />
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {empty ? 'Write the root first' : summary ? countLine(summary) : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={empty || confirming}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
