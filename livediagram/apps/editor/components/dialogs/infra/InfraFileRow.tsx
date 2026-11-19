// One file of the infrastructure panels (docs/specs/020-import-export/infrastructure-import.md "The editor" and
// "Updating a tab from its files"; blueprint "Accessibility and presentation"): its format as a word, its name, on the
// update panel its state, and its actions as icon buttons with tooltips. Paste opens a labelled box inside the row;
// Escape there closes the box, not the dialog.

import { useId, useState } from 'react';
import { Button, Tooltip, lucideGlyph } from '@livediagram/ui';
import {
  lucideClipboardPaste,
  lucideFileUp,
  lucideTrash2,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { entryStateLabel, type InfraEntry } from '@/lib/infra-files';
import { infraNeeded } from '@/lib/infra-import';

const ChooseGlyph = lucideGlyph(lucideFileUp, 16);
const PasteGlyph = lucideGlyph(lucideClipboardPaste, 16);
const RemoveGlyph = lucideGlyph(lucideTrash2, 16);
const KeepGlyph = lucideGlyph(lucideUndo2, 16);

// A row's square action: 32px for a finger, quiet until hovered, a ring on keyboard focus.
const ICON_BUTTON =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const FORMAT_WORD: Record<string, string> = {
  wrangler: 'Wrangler',
  compose: 'Compose',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
};

// The state chip's tone: a word always, colour only as a second cue.
const STATE_TONE: Record<string, string> = {
  Kept: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  New: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
  Replaced: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
  'No changes': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Needed: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  Removed: 'bg-slate-100 text-slate-600 line-through dark:bg-slate-800 dark:text-slate-300',
};

export function InfraFileRow({
  entry,
  format,
  unchanged = false,
  showState,
  disabled,
  onChoose,
  onPaste,
  onRemove,
}: {
  entry: InfraEntry;
  // The format read from the text, or remembered; absent while the parsers load.
  format?: string;
  // A replacement with the remembered fingerprint.
  unchanged?: boolean;
  // The update panel says each row's state; the import panel's rows are all new.
  showState: boolean;
  disabled: boolean;
  onChoose?: () => void;
  onPaste?: (text: string) => void;
  // Remove, or Keep a removed row again.
  onRemove: () => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState('');
  const pasteId = useId();
  const removed = entry.state === 'removed';
  const state = entryStateLabel(entry, unchanged);
  const closePaste = () => {
    setPasting(false);
    setDraft('');
  };

  return (
    <li
      className={`px-3 py-2 ${removed ? 'bg-slate-50/70 dark:bg-slate-900/40' : ''}`}
      data-infra-file={entry.name}
      data-state={entry.state}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className={`inline-flex h-5 min-w-[4.75rem] shrink-0 items-center justify-center rounded border px-1.5 text-[11px] font-semibold tracking-wide ${removed ? 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}
        >
          {format ? (FORMAT_WORD[format] ?? format) : '…'}
        </span>
        <span
          // A long path wraps rather than hiding its end, the part that tells two wrangler.toml files apart.
          className={`min-w-0 flex-1 font-mono text-xs break-all ${removed ? 'text-slate-500 line-through dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}
        >
          {entry.name}
        </span>
        {showState ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_TONE[state]}`}
          >
            {state}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {onChoose && !removed ? (
            <Tooltip label={`Choose ${entry.name}`}>
              <Button
                variant="none"
                className={ICON_BUTTON}
                aria-label={`Choose ${entry.name}`}
                onClick={onChoose}
                disabled={disabled}
              >
                <ChooseGlyph />
              </Button>
            </Tooltip>
          ) : null}
          {onPaste && !removed ? (
            <Tooltip label={`Paste ${entry.name}`}>
              <Button
                variant="none"
                className={ICON_BUTTON}
                aria-label={`Paste ${entry.name}`}
                aria-expanded={pasting}
                aria-controls={pasting ? pasteId : undefined}
                onClick={() => (pasting ? closePaste() : setPasting(true))}
                disabled={disabled}
              >
                <PasteGlyph />
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip label={removed ? `Keep ${entry.name}` : `Remove ${entry.name}`}>
            <Button
              variant="none"
              className={ICON_BUTTON}
              aria-label={removed ? `Keep ${entry.name}` : `Remove ${entry.name}`}
              onClick={() => {
                closePaste();
                onRemove();
              }}
              disabled={disabled}
            >
              {removed ? <KeepGlyph /> : <RemoveGlyph />}
            </Button>
          </Tooltip>
        </span>
      </div>
      {entry.state === 'needed' ? (
        <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-200">
          {infraNeeded(entry.name)}
        </p>
      ) : null}
      {pasting && onPaste ? (
        <div id={pasteId} className="mt-2">
          <textarea
            aria-label={`New text for ${entry.name}`}
            value={draft}
            autoFocus
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              // The box's Escape, not the dialog's.
              e.stopPropagation();
              e.preventDefault();
              closePaste();
            }}
            className="h-28 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/30"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={closePaste}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="xs"
              disabled={draft.trim().length === 0}
              onClick={() => {
                onPaste(draft);
                closePaste();
              }}
            >
              Use This Text
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
