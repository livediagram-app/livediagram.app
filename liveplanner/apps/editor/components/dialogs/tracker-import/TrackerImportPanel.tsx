'use client';

// The Import dialog's preview of a board from another tool (docs/specs/026-plan/tracker-import.md "The preview", "The
// import"): under the dialog's All Imports back bar, what the file will make and where it goes, then Import. The
// reading, planning and writing are useTrackerFlow's; this draws them.
import type { ReactNode } from 'react';
import { Button, DialogFooter } from '@liveplanner/ui';
import { trackerSummary } from '@liveplanner/items';
import { ImportError } from '../import/ImportError';
import { TrackerPreviewView } from './TrackerPreviewView';
import type { TrackerFlow, TrackerPreviewState } from './useTrackerFlow';

const SUMMARY = 'text-[12px] text-slate-500 dark:text-slate-400';

export function TrackerImportPanel({
  head,
  flow,
  preview,
}: {
  // What heads the body (the dialog's back bar).
  head?: ReactNode;
  flow: TrackerFlow;
  preview: TrackerPreviewState;
}) {
  const shown = preview.plans[preview.target]!.preview;
  const summary = trackerSummary(shown, preview.target);
  const busy = flow.busy !== null;

  // The body scrolls under the dialog's header; the actions stay in its footer, always in reach.
  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {head}
        <TrackerPreviewView
          preview={shown}
          target={preview.target}
          tabReason={preview.tabReason}
          onTarget={(t) => void flow.changeTarget(t)}
          disabled={busy}
        />
        {flow.error ? <ImportError>{flow.error}</ImportError> : null}
        {/* A phone's footer has room for its buttons alone: the line goes at the end of the preview. */}
        <p className={`sm:hidden ${SUMMARY}`}>{summary}</p>
      </div>
      <DialogFooter>
        <p className={`mr-auto hidden min-w-0 sm:block ${SUMMARY}`}>{summary}</p>
        <Button
          variant="secondary"
          size="md"
          className="shrink-0 whitespace-nowrap"
          // The picker again, for the same tool; a cancel keeps this preview.
          onClick={() => void flow.pick(preview.board.source)}
          disabled={busy}
        >
          Choose Another File
        </Button>
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Importing…", so the label swap moves nothing.
          className="min-w-[7.5rem] shrink-0"
          onClick={() => void flow.run()}
          disabled={busy}
        >
          {flow.busy === 'importing' ? 'Importing…' : 'Import'}
        </Button>
      </DialogFooter>
    </>
  );
}
