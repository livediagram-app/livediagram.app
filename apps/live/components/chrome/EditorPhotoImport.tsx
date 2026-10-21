'use client';

import dynamic from 'next/dynamic';
import { draftNotesOf } from '@liveplanner/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { PhotoDraftBar } from '@/components/chrome/PhotoDraftBar';
import { PhotoImportProgress } from '@/components/chrome/PhotoImportProgress';
import { PHOTO_ACCEPT_ATTR } from '@/lib/photo-accept';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';

// The photo review loads once a wall photo is picked (docs/specs/016-platform/web-performance.md).
const PhotoReviewOverlay = dynamic(
  () => import('@/components/chrome/PhotoReviewOverlay').then((m) => m.PhotoReviewOverlay),
  { ssr: false },
);

// Add from Photo (docs/specs/021-event-storming/event-storming.md Phases 8 and 9): the reading progress, the review,
// the draft awaiting Add or Discard, and the one hidden file input behind it.
export function EditorPhotoImport() {
  const { activeTab, photoDraft, photoImportAvailable, onPhotoPicked, photoPickerRef } =
    useEditorContext();
  // The photo draft awaiting a decision, and the session-local view state
  // that goes with it (docs/specs/021-event-storming/event-storming.md Phase 8).
  const draftNotes = draftNotesOf(activeTab.elements);
  const draftView = usePhotoDraftView();
  return (
    <>
      {/* What a photo import is doing BEFORE the draft lands: a progress
      strip from the moment the file is picked, with Cancel. */}
      <PhotoImportProgress state={photoDraft.state} onCancel={photoDraft.cancelReading} />

      {/* Step 1 + 2 of the wizard (docs/specs/021-event-storming/event-storming.md Phase 9): the photo with every
      box, tickable, and the words editable. Nothing lands until Add. */}
      {photoDraft.state.stage === 'review' && photoDraft.review ? (
        <PhotoReviewOverlay
          review={photoDraft.review}
          reading={
            photoDraft.state.readSoFar < photoDraft.state.found && !photoDraft.review.readError
          }
          modelDownload={photoDraft.state.modelDownload}
          readSoFar={photoDraft.state.readSoFar}
          readTotal={photoDraft.state.found}
          readerBackend={photoDraft.state.readerBackend}
          readerWhy={photoDraft.state.readerWhy}
          readerFallback={photoDraft.state.readerFallback}
          rereading={photoDraft.rereading}
          onReread={photoDraft.reread}
          onConfirm={photoDraft.confirm}
          onCancel={photoDraft.cancelReview}
          // "Try another photo": leave this review and open the picker
          // again, inside the same click, so the browser allows the dialog.
          onRetake={() => {
            photoDraft.cancelReview();
            photoPickerRef.current?.click();
          }}
        />
      ) : null}

      {/* A photo import awaiting Add or Discard (docs/specs/021-event-storming/event-storming.md Phase 8). Derived
      from the tab's own draft notes, so a reload mid-import comes back to
      the same decision rather than to a board full of strays. Hidden
      while the words are still being read: that moment belongs to the
      progress strip above. */}
      {photoDraft.state.stage !== 'detecting' ? (
        <PhotoDraftBar
          draftCount={draftNotes.length}
          read={draftView?.read ?? null}
          readError={draftView?.readError}
          matchedCount={draftView ? draftView.matchedIds.size : null}
          busy={photoDraft.state.stage === 'committing'}
          onAccept={photoDraft.accept}
          onDiscard={photoDraft.discard}
        />
      ) : null}

      {/* The one file input behind "Add from Photo". Hidden, opened by the
      palette row and the command palette; `capture` makes a phone open
      the camera straight away, because the act is "photograph this wall". */}
      {photoImportAvailable ? (
        <input
          ref={photoPickerRef}
          type="file"
          accept={PHOTO_ACCEPT_ATTR}
          capture="environment"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={onPhotoPicked}
        />
      ) : null}
    </>
  );
}
