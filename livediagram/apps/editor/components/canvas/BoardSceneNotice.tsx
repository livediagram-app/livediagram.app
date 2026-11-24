'use client';

// The paste notice (docs/specs/020-import-export/board-scene.md "In the editor"): after a paste that
// changed or dropped anything, a small non-blocking status at the bottom of the canvas says what;
// while images store, it shows their progress. It never takes the focus and never times out under
// the reader: its close (or Escape inside it), the next paste, or another tab clears it. A notice in the toast stack
// (liveworkspace/docs/specs/016-notifications/toasts.md "One place for everything that pops up"), in the toast's
// card: warning for changes, error for a refusal, stacked with its title and list.
import { ToastCard, ToastNotice } from '@liveworkspace/ui/toast';
import type { KeyboardEvent } from 'react';
import { describeImportImageReport } from '@/lib/import-images';
import type { BoardSceneNoticeState, BoardSceneSource } from '@/hooks/canvas/useBoardSceneInsert';
import { BoardSceneReportList } from '@/components/dialogs/BoardSceneReportList';

const SOURCE_NAMES: Readonly<Record<BoardSceneSource, string>> = {
  excalidraw: 'Excalidraw',
  'microsoft-whiteboard': 'Microsoft Whiteboard',
};

export function BoardSceneNotice({
  notice,
  onClose,
}: {
  notice: BoardSceneNoticeState | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  const source = SOURCE_NAMES[notice.source];
  const images =
    notice.kind === 'report' && notice.images ? describeImportImageReport(notice.images) : null;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && notice.kind !== 'progress') {
      e.stopPropagation();
      onClose();
    }
  };
  return (
    // In the toast stack, above any toast, holding the notice slot while it shows (so a suggestion waits).
    <ToastNotice>
      {notice.kind === 'progress' ? (
        <ToastCard
          tone="info"
          role="status"
          aria-live="polite"
          data-testid="board-scene-notice"
          message={`Pasting images ${notice.done} of ${notice.total}…`}
        />
      ) : notice.kind === 'refused' ? (
        <ToastCard
          tone="error"
          role="status"
          aria-live="polite"
          data-testid="board-scene-notice"
          title={`Couldn't paste from ${source}`}
          message={notice.message}
          onClose={onClose}
          onKeyDown={onKeyDown}
        />
      ) : (
        <ToastCard
          tone="warning"
          role="status"
          aria-live="polite"
          data-testid="board-scene-notice"
          title={`Pasted from ${source} with some changes`}
          onClose={onClose}
          onKeyDown={onKeyDown}
          body={
            <div className="text-xs leading-4 text-slate-600 dark:text-slate-300 [&_ul]:mt-1 [&_ul]:space-y-1">
              <BoardSceneReportList report={notice.report} />
              {images && images.failures.length > 0 ? (
                <ul>
                  {images.failures.map((f) => (
                    <li key={f.failure} data-failure={f.failure}>
                      <span className="font-semibold tabular-nums">{f.count}</span> · {f.sentence}
                    </li>
                  ))}
                </ul>
              ) : null}
              {images?.hint ? <p className="mt-1.5">{images.hint}</p> : null}
            </div>
          }
        />
      )}
    </ToastNotice>
  );
}
