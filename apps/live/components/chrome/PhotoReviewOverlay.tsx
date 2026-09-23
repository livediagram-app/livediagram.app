'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';
import { NoteBox, sizeOf } from './photo/NoteBox';
import { PhotoStatus } from './photo/PhotoStatus';
import { TruthExport } from './photo/TruthExport';
import { ZoomControls } from './photo/ZoomControls';
import { withKind } from '@/lib/photo-boxes';
import { truthArmed } from '@/lib/photo-truth';
import { useBoxDrag } from './photo/useBoxDrag';
import { useDrawBox } from './photo/useDrawBox';
import { useReviewBoxes } from './photo/useReviewBoxes';
import { usePhotoView } from './photo/usePhotoView';
import { kindOfBox } from './photo/kindOfBox';

// Reviewing a photographed wall (spec/139 Phase 9).
//
// THE LAYOUT CONTRACT: the photograph IS the interface. It is sized to fit the
// viewport with its aspect ratio intact, and everything else — the boxes, the
// words read off each sticky, the tick that keeps a note out, the status, the
// two ways out — floats ON it. There is no sidebar and no footer strip: a list
// of notes beside the photo asks the author to match thirty rows against
// thirty pieces of paper by eye, when the paper is right there.
//
// What a box says is the WORDS. The kind is the box's colour, which is the
// notation's own alphabet; printing "Domain event" over the handwriting only
// hid the one thing the author has to check.
//
// Nothing here writes: Add hands the ticked boxes, the boxes the author drew
// and the words as edited to the hook, which is the one place a draft lands.

// At most two boxes a second, so the wall is seen being read rather than
// arriving all at once. Presentational only: every box exists from the start.
const REVEAL_INTERVAL_MS = 500;
// …and the whole reveal fits in this, however many boxes there are. The
// reveal is a flourish that says the wall is being read, not a progress bar to
// sit through: at a flat half-second a box, a 54-note wall took twenty-seven
// seconds before the author could do anything with it. The budget is spread
// EVENLY over every box — a leisurely start followed by a sudden flush would
// read as the animation giving up.
const REVEAL_BUDGET_MS = 6000;

// …and a box needs this much of the working image to classify its paper.
const MIN_BOX_PX = 3;

const revealStepMs = (boxes: number) =>
  boxes <= 0 ? REVEAL_INTERVAL_MS : Math.min(REVEAL_INTERVAL_MS, REVEAL_BUDGET_MS / boxes);

export function PhotoReviewOverlay({
  review,
  reading,
  onConfirm,
  onCancel,
}: {
  review: PhotoReview;
  reading: boolean;
  // The boxes to land AS THEY STAND — ticked, corrected, drawn — and the
  // words on each.
  onConfirm: (
    kept: DetectedSticky[],
    texts: Map<number, { text: string; legible: boolean }>,
  ) => void;
  onCancel: () => void;
}) {
  // The photograph is up before the detector has said anything, so everything
  // derived from a detection has to hold for "not yet". The 1×1 stand-in size
  // is never used to place a box (there are none until detection lands); it
  // only keeps the percentage maths total.
  const detection = review.detection;
  const detected = detection?.stickies ?? [];
  const frame = detection?.imageSize ?? { width: 1, height: 1 };
  // Still looking. Distinct from "looked and found nothing", which is advice.
  const detecting = detection === null;
  const foundNothing = detection !== null && detected.length === 0;
  // Whether the browser has actually PAINTED the photograph yet. The surface
  // opens before the image has been decoded, so there is a moment with a frame
  // and no picture in it — and a frame with nothing in it, unexplained, is the
  // same "is this broken?" as no surface at all.
  const [photoShown, setPhotoShown] = useState(false);
  // The boxes as the author has corrected them, which are ticked, and which
  // one is selected for correcting.
  const edits = useReviewBoxes(detected, detection);
  const notes = edits.boxes;
  // Where each DETECTED box comes in the reveal; a drawn or reopened box is
  // there at once.
  const revealAt = new Map(detected.map((s, i) => [s.id, i]));
  // The author's edits only; every unedited note streams straight from the
  // review as the words arrive.
  const [edited, setEdited] = useState<Map<number, string>>(() => new Map());
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    setRevealed(0);
    if (detected.length === 0) return;
    const id = setInterval(() => {
      setRevealed((r) => {
        if (r >= detected.length) {
          clearInterval(id);
          return r;
        }
        return r + 1;
      });
    }, revealStepMs(detected.length));
    return () => clearInterval(id);
  }, [detected.length]);

  // Escape lets go of a selected box, and only then leaves; Delete removes the
  // selected box. An input being edited stops the event first, so Escape
  // there reverts the words and Backspace deletes a letter.
  const { selected, select, remove } = edits;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === 'Escape') {
        if (selected !== null) select(null);
        else onCancel();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selected !== null) {
        e.preventDefault();
        remove(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, selected, select, remove]);

  const textOf = useCallback(
    (id: number): string => edited.get(id) ?? review.textById.get(id)?.text ?? '',
    [edited, review.textById],
  );

  const editText = (id: number, value: string) => {
    setEdited((prev) => {
      const next = new Map(prev);
      if (value.trim() === '') next.delete(id);
      else next.set(id, value);
      return next;
    });
  };

  const addManual = (box: { x: number; y: number; w: number; h: number }) => {
    // Whether it was a click or a drag is decided on SCREEN (see onPointerUp);
    // this only refuses a box with no area to classify.
    if (box.w < MIN_BOX_PX || box.h < MIN_BOX_PX) return;
    if (!detection) return;
    const kind = kindOfBox(detection.imageData, detection.imageSize, box);
    edits.add({ kind, size: sizeOf(kind), ...box, row: 0, order: 0, confidence: 1 });
  };

  // Reopen a saved label: its boxes replace the detection's, its words the
  // read. A file that is not a label for THIS photo is refused out loud.
  const [labelError, setLabelError] = useState<string | null>(null);
  const openLabel = async (file: File) => {
    try {
      if (!detection) throw new Error('Wait for the photo to finish loading, then open the label.');
      const words = edits.load(JSON.parse(await file.text()), review.photoName, frame);
      setEdited(new Map(words));
      setLabelError(null);
    } catch (err) {
      setLabelError(
        err instanceof SyntaxError
          ? 'That file is not a saved label.'
          : err instanceof Error
            ? err.message
            : String(err),
      );
    }
  };

  const confirm = () => {
    const texts = new Map<number, { text: string; legible: boolean }>();
    for (const s of notes) {
      const text = textOf(s.id);
      texts.set(s.id, { text, legible: text.trim() !== '' });
    }
    onConfirm(edits.kept, texts);
  };

  // The photo area: drag on it (not on a box's controls) to draw a sticky the
  // detector missed.
  const photoRef = useRef<HTMLDivElement | null>(null);
  const draw = useDrawBox({ pictureRef: photoRef, frame, onBox: addManual });
  const boxDrag = useBoxDrag({ pictureRef: photoRef, frame, onChange: edits.update });
  // A second finger turns a one-finger drag into a pinch: the box that finger
  // started is not a box, and the box it grabbed is not being moved.
  const photoView = usePhotoView({
    onGesture: () => {
      draw.cancel();
      boxDrag.cancel();
    },
  });

  return (
    <div
      data-testid="photo-review-overlay"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 p-2"
      role="dialog"
      aria-modal="true"
      aria-label="Review the notes found in your photo"
      // A saved label dropped on the photo opens it, where labelling is on.
      onDragOver={(e) => {
        if (truthArmed() && e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        const file = e.dataTransfer.files[0];
        if (!truthArmed() || !file || !/\.json$/i.test(file.name)) return;
        e.preventDefault();
        e.stopPropagation();
        void openLabel(file);
      }}
    >
      <div
        data-testid="photo-frame"
        // A minimum size so the frame is THERE from the first paint, before
        // the image has any dimensions of its own to give it — and a flex
        // centre, because the picture inside it is its own size.
        className="relative flex min-h-[40vmin] min-w-[40vmin] items-center justify-center overflow-hidden rounded-lg bg-slate-800/60 shadow-2xl"
      >
        {/*
          THE BOXES ARE MEASURED AGAINST THE PICTURE, NOT THE FRAME. Every box
          is placed as a percentage, so the element those percentages resolve
          against must be exactly the image and nothing more. This wrapper
          shrink-wraps it (a flex item is sized by its content), so a frame
          that is TALLER than the photo — a wide panorama in a tall window,
          where the frame's minimum height wins — cannot push the boxes down
          the picture. Measured before this existed: 101px of drift at
          900×1100, and it moved as the window was resized.
        */}
        {/*
          The VIEWPORT clips the zoomed picture to the fitted size. The picture
          inside it keeps its fitted LAYOUT size and is zoomed with a
          transform, so the percentages above still resolve against exactly
          the image, and the pointer maths — which reads the picture's
          on-screen rect — is right at every zoom without knowing there is one.
        */}
        <div
          ref={photoView.viewportRef}
          data-testid="photo-viewport"
          // `touch-none`: a pinch here zooms the PHOTO, never the whole page.
          className="relative touch-none overflow-hidden"
          style={photoView.hand ? { cursor: photoView.hand } : undefined}
          {...photoView.viewportHandlers}
        >
          <div
            ref={photoRef}
            data-testid="photo-picture"
            className={`relative select-none ${photoView.hand ? '' : 'cursor-crosshair'}`}
            style={{
              transform: `translate(${photoView.view.x}px, ${photoView.view.y}px) scale(${photoView.view.zoom})`,
              transformOrigin: '0 0',
            }}
            {...draw.handlers}
            // A press on bare photo lets go of the selected box (and may draw
            // a new one); a press on a box's body never reaches here.
            onPointerDown={(e) => {
              select(null);
              draw.handlers.onPointerDown(e);
            }}
          >
            <img
              src={review.photoUrl}
              alt="The photographed wall"
              draggable={false}
              onLoad={() => setPhotoShown(true)}
              // Room at the bottom for the action bar, so it never covers a
              // note's words.
              className="block h-auto max-h-[88vh] w-auto max-w-[96vw] object-contain"
            />
            {notes.map((s) => (
              <NoteBox
                key={s.id}
                note={s}
                frame={frame}
                text={textOf(s.id)}
                reading={reading}
                ticked={edits.ticked.has(s.id)}
                // A box the author DREW appears at once; only the detector's own
                // are revealed one at a time.
                shown={(revealAt.get(s.id) ?? -1) < revealed}
                onToggle={() => edits.toggle(s.id)}
                selected={selected === s.id}
                onGrab={(e) => {
                  select(s.id);
                  boxDrag.begin(e, s, 'move');
                }}
                onResizeStart={(e, corner) => boxDrag.begin(e, s, corner)}
                onKind={(kind) => edits.update(s.id, withKind(s, kind))}
                onDelete={() => remove(s.id)}
                onEdit={(value) => editText(s.id, value)}
                zoom={photoView.view.zoom}
              />
            ))}
            {draw.drawing ? (
              <div
                aria-hidden
                className="pointer-events-none absolute border-2 border-dashed border-white"
                style={{
                  left: `${Math.min(draw.drawing.x1, draw.drawing.x2)}%`,
                  top: `${Math.min(draw.drawing.y1, draw.drawing.y2)}%`,
                  width: `${Math.abs(draw.drawing.x2 - draw.drawing.x1)}%`,
                  height: `${Math.abs(draw.drawing.y2 - draw.drawing.y1)}%`,
                }}
              />
            ) : null}
          </div>
        </div>
        {photoShown ? null : (
          // On the FRAME, not on the picture: before the image has loaded the
          // picture has no dimensions to fill, and a skeleton in a collapsed
          // box is a blank overlay.
          <div
            data-testid="photo-loading"
            className="absolute inset-0 flex animate-pulse items-center justify-center gap-2 text-xs text-slate-300"
          >
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400"
            />
            Loading your photo…
          </div>
        )}
        <div className="pointer-events-none absolute right-2 top-2">
          <ZoomControls
            zoom={photoView.view.zoom}
            onZoomIn={photoView.zoomIn}
            onZoomOut={photoView.zoomOut}
            onFit={photoView.fit}
          />
        </div>
        <PhotoStatus
          detecting={detecting}
          foundNothing={foundNothing}
          revealed={revealed}
          detected={detected.length}
          reading={reading}
          readError={review.readError}
          dropped={detection?.dropped ?? 0}
          labelError={labelError}
        />
      </div>

      {/* The two ways out, floating over the dimmed margin below the photo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-3">
        <p className="pointer-events-auto rounded-full bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur">
          {detecting
            ? 'Finding the stickies…'
            : `${edits.ticked.size} of ${notes.length} · drag the photo to add one`}
        </p>
        {detection ? (
          <TruthExport
            photoName={review.photoName}
            size={detection.imageSize}
            notes={notes}
            ticked={edits.ticked}
            textOf={textOf}
            onOpen={(file) => void openLabel(file)}
          />
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="pointer-events-auto rounded-full border border-white/40 bg-slate-900/70 px-4 py-1.5 text-sm text-white shadow-lg backdrop-blur hover:bg-slate-900/90"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={edits.ticked.size === 0}
          className="pointer-events-auto rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-600 disabled:opacity-50"
        >
          Add {edits.ticked.size} {edits.ticked.size === 1 ? 'note' : 'notes'}
        </button>
      </div>
    </div>
  );
}
