import { useState } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { BackBar, Glyph, DialogCloseButton, DialogHeader } from '@liveplanner/ui';
import {
  TRACKER_FILE_MAX_BYTES,
  TRACKER_SOURCE_NAMES,
  type TrackerSource,
} from '@liveplanner/items';
import { ImportReport } from '@liveworkspace/workbench/components/dialogs/ImportReport';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ImportOutcome } from '@/lib/import-tab';
import { TRACKER_TOO_BIG } from '@/lib/tracker-file';
import type { TrackerImportActions } from '@/hooks/plan/useTrackerImport';
import { TextImportPanel } from './TextImportPanel';
import { TrackerImportPanel } from './tracker-import/TrackerImportPanel';
import { useTrackerFlow } from './tracker-import/useTrackerFlow';
import { ImportChooseView } from './import/ImportChooseView';
import { intoTabCopy } from './import/import-options';
import { routeImportDrop } from './import/import-drop';
import type { IntoTab } from './import/into-tab';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // What the tab itself takes (its CSV, or a liveplanner tab's JSON), and whether this person may.
  intoTab: IntoTab;
  // Runs a file import: opens the file picker, parses, and replaces the active
  // tab. Returns an outcome so this dialog can close / stay open / show an
  // error without throwing.
  onImportFile: () => Promise<ImportOutcome>;
  // Runs a text import (the paste path), bypassing the file picker.
  onImportText: (text: string) => Promise<ImportOutcome>;
  // A board from another tool (docs/specs/026-plan/tracker-import.md): an Editor's, so without `canImport` the
  // dialog has no tool section.
  tracker: TrackerImportActions;
  onClose: () => void;
};

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

const BACK = 'All Imports';

// The one Import dialog (docs/specs/026-plan/plan-tabs.md "The Import dialog"), counterpart to ExportTabDialog:
// every way in, as a list. Into This Tab is the tab's own import (a Board or Sheet tab's CSV through its own picker,
// any other tab's liveplanner Tab JSON, which REPLACES the tab and so leads with a warning); A Board from Another Tool
// is Trello, Asana, Jira and Linear, each previewed before anything is written. A file dropped on the list goes where
// it belongs. Errors render inline; on success the dialog closes, or shows what could not land.
export function ImportTabDialog({
  tabName,
  intoTab,
  onImportFile,
  onImportText,
  tracker,
  onClose,
}: ImportTabDialogProps) {
  const tools = tracker.canImport;
  // With nothing to choose between (the liveplanner Tab alone), the dialog opens straight at it.
  const jsonAlone = !tools && intoTab.kind === 'json' && !intoTab.blocked;
  const [step, setStep] = useState<'list' | 'json'>(jsonAlone ? 'json' : 'list');
  // A dropped liveplanner tab's JSON, put in the box to import with a press.
  const [jsonText, setJsonText] = useState('');
  // Set once an import that left something out has landed: the dialog then
  // shows how it came across instead of closing.
  const [report, setReport] = useState<DoneOutcome | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const flow = useTrackerFlow(tracker, onClose);

  const pickIntoTab = () => {
    if (intoTab.blocked) return;
    clearErrors();
    if (intoTab.kind === 'json') {
      setStep('json');
      return;
    }
    // The tab's own picker opens as the dialog goes (plan-board.md "CSV", sheet.md "CSV").
    intoTab.onPick();
    onClose();
  };

  const pickTool = (source: TrackerSource) => {
    setDropError(null);
    void flow.pick(source);
  };

  // A new choice starts clean: the last file's refusal goes.
  const clearErrors = () => {
    setDropError(null);
    flow.back();
  };

  const dropFile = async (file: File) => {
    if (flow.busy) return;
    clearErrors();
    // Refused unread past the cap, as a picked file is.
    if (file.size > TRACKER_FILE_MAX_BYTES) {
      setDropError(TRACKER_TOO_BIG);
      return;
    }
    const text = await file.text();
    const route = routeImportDrop(text, file.name, { intoTab, tools });
    debugLog('[import] drop', { to: route.to, bytes: file.size });
    if (route.to === 'error') setDropError(route.error);
    else if (route.to === 'tracker') await flow.show(route.read);
    else if (route.to === 'tab-csv' && intoTab.kind === 'csv') {
      intoTab.onFile(file);
      onClose();
    } else if (route.to === 'tab-json') {
      setJsonText(text);
      setStep('json');
    }
  };

  const preview = step === 'list' ? flow.preview : null;
  const toolName = preview ? TRACKER_SOURCE_NAMES[preview.board.source] : null;
  const title = step === 'json' ? 'Import to Tab' : toolName ? `Import from ${toolName}` : 'Import';
  const subtitle =
    step === 'json' ? (
      report ? (
        "Here's how your import came across."
      ) : (
        'Paste your JSON, or import a file.'
      )
    ) : toolName ? (
      'See what it will make, then import it.'
    ) : (
      <>
        Choose what to bring in
        {/* Only where a file can be dragged in. */}
        <span className="pointer-coarse:hidden">, or drop a file here</span>.
      </>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Import"
      size="xl"
      className="max-h-[90vh]"
      // Nobody starts at the help link: focus the panel, the rows a Tab away.
      initialFocus="container"
    >
      <DialogHeader title={title} subtitle={subtitle}>
        <HelpArticleLink article="importTabs" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      {preview ? (
        <TrackerImportPanel
          head={
            <BackBar
              label={BACK}
              current={toolName!}
              onClick={flow.back}
              disabled={flow.busy !== null}
              gap="none"
            />
          }
          flow={flow}
          preview={preview}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'json' ? (
            <>
              {!jsonAlone && !report ? (
                <BackBar
                  label={BACK}
                  current={intoTabCopy(intoTab).label}
                  onClick={() => setStep('list')}
                />
              ) : null}
              {report ? (
                <ImportReport failures={report.failures} onDone={onClose} />
              ) : (
                <>
                  {/* Destructive-action warning: this overwrites the tab. */}
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
                    initialText={jsonText}
                    onImportText={onImportText}
                    onImportFile={onImportFile}
                    onDone={(outcome) =>
                      (outcome.failures?.length ?? 0) > 0 ? setReport(outcome) : onClose()
                    }
                  />
                </>
              )}
            </>
          ) : (
            <ImportChooseView
              intoTab={intoTab}
              tools={tools}
              reading={flow.reading}
              error={dropError ?? flow.error}
              onIntoTab={pickIntoTab}
              onTool={pickTool}
              onDropFile={(file) => void dropFile(file)}
            />
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
