'use client';

// The paste notice (docs/specs/020-import-export/board-scene.md "In the editor"): after a paste that
// changed or dropped anything, a small non-blocking status at the bottom of the canvas says what;
// while images store, it shows their progress. It never takes the focus and never times out under
// the reader: its close (or Escape inside it), the next paste, or another tab clears it. A floating
// callout (liveworkspace/docs/specs/016-notifications/callouts.md): warning for changes, error for a refusal.
import { Callout } from '@liveworkspace/ui/callout';
import { describeImportImageReport } from '@/lib/import-images';
import type { BoardSceneNoticeState, BoardSceneSource } from '@/hooks/canvas/useBoardSceneInsert';
import { BoardSceneReportList } from '@/components/dialogs/BoardSceneReportList';
import { useNoticeSlot } from './useNoticeSlot';

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
  const bottom = useNoticeSlot(notice !== null);
  if (!notice) return null;
  const source = SOURCE_NAMES[notice.source];
  const images =
    notice.kind === 'report' && notice.images ? describeImportImageReport(notice.images) : null;
  return (
    // Bottom centre, in its own slot above the dock (lib/board-scene-notice-slot); measured before
    // paint and hidden until then, so it never shows in the wrong place nor moves anything.
    <div
      className="pointer-events-none fixed inset-x-0 z-[var(--z-overlay)] flex justify-center px-4"
      style={bottom === null ? { bottom: 0, visibility: 'hidden' } : { bottom }}
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="board-scene-notice"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && notice.kind !== 'progress') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="pointer-events-auto w-full max-w-[360px] motion-safe:animate-fade-in"
      >
        {notice.kind === 'progress' ? (
          <Callout tone="info" size="md" floating>
            Pasting images {notice.done} of {notice.total}…
          </Callout>
        ) : notice.kind === 'refused' ? (
          <Callout
            tone="error"
            size="md"
            floating
            title={`Couldn't paste from ${source}`}
            onClose={onClose}
          >
            <span className="mt-1 block text-xs">{notice.message}</span>
          </Callout>
        ) : (
          <Callout
            tone="warning"
            size="md"
            floating
            title={`Pasted from ${source} with some changes`}
            onClose={onClose}
          >
            <BoardSceneReportList report={notice.report} />
            {images && images.failures.length > 0 ? (
              <ul className="mt-1 space-y-1 text-xs">
                {images.failures.map((f) => (
                  <li key={f.failure} data-failure={f.failure}>
                    <span className="font-semibold tabular-nums">{f.count}</span> · {f.sentence}
                  </li>
                ))}
              </ul>
            ) : null}
            {images?.hint ? <p className="mt-2 text-xs">{images.hint}</p> : null}
          </Callout>
        )}
      </div>
    </div>
  );
}
