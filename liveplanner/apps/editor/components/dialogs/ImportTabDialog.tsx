import { useState } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportReport } from '@liveworkspace/workbench/components/dialogs/ImportReport';
import { Glyph, DialogCloseButton, DialogHeader } from '@liveplanner/ui';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import type { ImportView } from '@/app/project/[id]/useEditorDialogs';
import type { TrackerImportActions } from '@/hooks/plan/useTrackerImport';
import { TrackerImportPanel } from './tracker-import/TrackerImportPanel';

const VIEWS = [
  { id: 'file', label: 'liveplanner File' },
  { id: 'tracker', label: 'Another Tool' },
] as const satisfies readonly { id: ImportView; label: string }[];

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import: opens the file picker, parses, and replaces the active
  // tab. Returns an outcome so this dialog can close / stay open / show an
  // error without throwing.
  onImportFile: () => Promise<ImportOutcome>;
  // Runs a text import (the paste path), bypassing the file picker.
  onImportText: (text: string) => Promise<ImportOutcome>;
  // The view shown, and its switch (docs/specs/026-plan/tracker-import.md "Where it lives"): a board from another
  // tool is an Editor's, so without `tracker.canImport` the dialog is the file view alone.
  view: ImportView;
  onView: (view: ImportView) => void;
  tracker: TrackerImportActions;
  onClose: () => void;
};

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// Counterpart to ExportTabDialog: import a liveplanner tab's JSON export INTO
// the current tab. Importing REPLACES the tab's contents, so the dialog leads
// with a warning before the paste-or-file panel. Errors render inline; on
// success the dialog closes, or shows what could not land.
export function ImportTabDialog({
  tabName,
  onImportFile,
  onImportText,
  view: asked,
  onView,
  tracker,
  onClose,
}: ImportTabDialogProps) {
  const view: ImportView = tracker.canImport ? asked : 'file';
  // Set once an import that left something out has landed: the dialog then
  // shows how it came across instead of closing.
  const [report, setReport] = useState<DoneOutcome | null>(null);
  // liveplanner File or Another Tool, for an Editor (tracker-import.md "Where it lives").
  const switcher =
    tracker.canImport && !report ? (
      <SegmentedRadio label="Import from" options={VIEWS} value={view} onChange={onView} />
    ) : null;

  return (
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      <DialogHeader
        title={view === 'tracker' ? 'Import from Another Tool' : 'Import to Tab'}
        subtitle={
          view === 'tracker'
            ? 'Bring a Trello, Asana, Jira or Linear board into liveplanner.'
            : report
              ? "Here's how your import came across."
              : 'Paste your JSON, or import a file.'
        }
      >
        <HelpArticleLink article="importTabs" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      {view === 'tracker' ? (
        <TrackerImportPanel head={switcher} tracker={tracker} onDone={onClose} />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {switcher ? <div className="mb-4">{switcher}</div> : null}
          {report ? (
            <ImportReport failures={report.failures} onDone={onClose} />
          ) : (
            <>
              {/* Destructive-action warning — this overwrites the tab. */}
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="mt-0.5 shrink-0">
                  <WarningIcon />
                </span>
                <span>
                  This replaces everything on{' '}
                  <strong className="font-semibold">{tabName || 'this tab'}</strong> with the
                  imported content. Undo
                  {/* The keys only where there is a keyboard to press them. */}
                  <span className="pointer-coarse:hidden"> (⌘Z / Ctrl&#8209;Z)</span> brings it
                  back.
                </span>
              </div>
              <TextImportPanel
                placeholder={
                  '{\n  "schemaVersion": 1,\n  "kind": "liveplanner.tab",\n  "tab": { … }\n}'
                }
                onImportText={onImportText}
                onImportFile={onImportFile}
                onDone={(outcome) =>
                  (outcome.failures?.length ?? 0) > 0 ? setReport(outcome) : onClose()
                }
              />
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

function WarningIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 2.5 1.5 14h13L8 2.5Z" />
      <path d="M8 6.5v3.5" />
      <path d="M8 12h.01" />
    </Glyph>
  );
}
