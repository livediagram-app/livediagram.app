'use client';

// Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the map as an indented outline
// in one text area, Tab / Shift+Tab to indent and outdent the lines the caret is on, a quiet count
// of what Save will do, and, when Save would remove nodes, a question first: Keep Editing or Remove.
// ⌘/Ctrl+Enter saves; Escape cancels (the Dialog's own).
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, CloseIcon } from '@livediagram/ui';
import { parseMindOutline, type MindOutlineSummary } from '@livediagram/document';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from './DialogHeader';

// The indentation one level deeper is written with (mind-outline-text.ts).
const INDENT = '  ';
// Removed nodes the question names before "and N more".
const NAMED_REMOVALS = 3;

/** The outline's lines from the one the selection starts on to the one it ends on, re-indented. */
function reindent(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): { value: string; start: number; end: number } {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const toBreak = value.indexOf('\n', end === start ? end : end - 1);
  const to = toBreak === -1 ? value.length : toBreak;
  const lines = value.slice(from, to).split('\n');
  let first = 0;
  let total = 0;
  const changed = lines.map((line, i) => {
    const delta = outdent ? -Math.min(INDENT.length, line.length - line.trimStart().length) : 2;
    if (i === 0) first = delta;
    total += delta;
    return delta < 0 ? line.slice(-delta) : INDENT + line;
  });
  return {
    value: value.slice(0, from) + changed.join('\n') + value.slice(to),
    start: Math.max(from, start + first),
    end: end + total,
  };
}

function countLine(s: MindOutlineSummary): string {
  const parts = [
    s.added ? `${s.added} added` : '',
    s.renamed ? `${s.renamed} renamed` : '',
    s.moved ? `${s.moved} moved` : '',
    s.removed.length ? `${s.removed.length} removed` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
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
  const [draft, setDraft] = useState(initialText);
  const [confirming, setConfirming] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const empty = useMemo(() => parseMindOutline(draft) === null, [draft]);
  const summary = useMemo(() => (empty ? null : summarise(draft)), [draft, empty, summarise]);

  const save = () => {
    if (!summary) return;
    if (summary.removed.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(draft);
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
      return;
    }
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const next = reindent(el.value, el.selectionStart, el.selectionEnd, e.shiftKey);
    setDraft(next.value);
    requestAnimationFrame(() => {
      el.selectionStart = next.start;
      el.selectionEnd = next.end;
    });
  };

  const removed = summary?.removed ?? [];
  const names = removed
    .slice(0, NAMED_REMOVALS)
    .map((n) => `“${(n.label ?? '').trim() || 'Untitled'}”`)
    .join(', ');
  const more = removed.length - NAMED_REMOVALS;

  return (
    <Dialog open onClose={onClose} ariaLabel="Edit Outline" size="lg" className="max-h-[90vh]">
      <DialogHeader
        title="Edit Outline"
        subtitle="The first line is the root; indent a line under another to make it a child."
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={18} />
        </button>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-3 px-6 py-4">
        <textarea
          ref={area}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setConfirming(false);
          }}
          onKeyDown={onKeyDown}
          spellCheck
          autoFocus
          rows={16}
          aria-label="Outline"
          placeholder={'Root\n- Branch\n  - Leaf'}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm leading-6 text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {confirming ? (
          <div
            role="alertdialog"
            aria-label={`Remove ${removed.length} ${removed.length === 1 ? 'node' : 'nodes'}?`}
            className="rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Remove {removed.length} {removed.length === 1 ? 'node' : 'nodes'}?
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {names}
              {more > 0 ? ` and ${more} more` : ''} will go, with{' '}
              {removed.length === 1 ? 'its' : 'their'} connectors. Undo brings them back.
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setConfirming(false);
                  area.current?.focus();
                }}
              >
                Keep Editing
              </Button>
              <Button size="sm" variant="danger" autoFocus onClick={save}>
                Remove
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {empty ? 'Write at least the root' : summary ? countLine(summary) : ''}
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
