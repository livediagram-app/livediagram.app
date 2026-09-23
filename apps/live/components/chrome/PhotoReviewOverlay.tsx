'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';
import { NoteBox, sizeOf } from './photo/NoteBox';
import { PhotoStatus } from './photo/PhotoStatus';
import { TruthExport } from './photo/TruthExport';
import { ZoomControls } from './photo/ZoomControls';
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

// A drag shorter than this on screen, either way, is a click.
const DRAW_MIN_SCREEN_PX = 6;
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
  onConfirm: (
    ticked: Set<number>,
    texts: Map<number, { text: string; legible: boolean }>,
    manual: DetectedSticky[],
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
  // Everything found is ticked: the common case is "add the wall", and making
  // the author tick thirty boxes to get there would be a toll gate.
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(detected.map((s) => s.id)));
  // The surface MOUNTS before the detector has answered, so seeding the set
  // once at mount seeds it from nothing. Tick each detection as it lands.
  useEffect(() => {
    setTicked(new Set(detected.map((s) => s.id)));
    // Identity of the detection, not of the array: this must run once when the
    // answer arrives, and never again on a re-render that ticks a box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection]);
  // The author's edits only; every unedited note streams straight from the
  // review as the words arrive.
  const [edited, setEdited] = useState<Map<number, string>>(() => new Map());
  // Boxes the author drew around stickies the detector missed.
  const [manual, setManual] = useState<DetectedSticky[]>([]);
  const manualId = useRef(-1);
  // The in-progress drag, in percentages of the photo. The REF is the source
  // of truth (so a pointermove never reads a stale state); the state only
  // drives the dashed rectangle's render.
  const drawingRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );

  const notes = [...detected, ...manual];
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

  // Escape leaves, from anywhere on the surface. An input being edited stops
  // the event first, so Escape there reverts the words instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const textOf = useCallback(
    (id: number): string => edited.get(id) ?? review.textById.get(id)?.text ?? '',
    [edited, review.textById],
  );

  const toggle = (id: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    const id = manualId.current;
    manualId.current -= 1;
    const kind = kindOfBox(detection.imageData, detection.imageSize, box);
    setManual((prev) => [
      ...prev,
      { id, kind, size: sizeOf(kind), ...box, row: 0, order: 0, confidence: 1 },
    ]);
    setTicked((prev) => new Set(prev).add(id));
  };

  const confirm = () => {
    const texts = new Map<number, { text: string; legible: boolean }>();
    for (const s of notes) {
      const text = textOf(s.id);
      texts.set(s.id, { text, legible: text.trim() !== '' });
    }
    onConfirm(
      new Set(detected.filter((s) => ticked.has(s.id)).map((s) => s.id)),
      texts,
      manual.filter((m) => ticked.has(m.id)),
    );
  };

  // The photo area: drag on it (not on a box's controls) to draw a sticky the
  // detector missed.
  const photoRef = useRef<HTMLDivElement | null>(null);
  const photoView = usePhotoView();
  // Where the drag started ON SCREEN, to tell a click from a drag.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const point = (e: PointerEvent<HTMLDivElement>) => {
    const rect = photoRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    const p = point(e);
    drawingRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setDrawing({ ...drawingRef.current });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const p = point(e);
    drawingRef.current = { ...drawingRef.current, x2: p.x, y2: p.y };
    setDrawing({ ...drawingRef.current });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drawingRef.current;
    if (!d) return;
    drawingRef.current = null;
    setDrawing(null);
    // A click, not a box. Measured on SCREEN, because a fixed share of the
    // photo was a click at one zoom and a whole sticky at another: on a
    // three-hundred-note whiteboard a note is 1.5% of the photo, and a "2% is
    // a click" rule made those notes impossible to draw round.
    const start = dragStart.current;
    dragStart.current = null;
    if (
      start &&
      (Math.abs(e.clientX - start.x) < DRAW_MIN_SCREEN_PX ||
        Math.abs(e.clientY - start.y) < DRAW_MIN_SCREEN_PX)
    ) {
      return;
    }
    const x1 = Math.min(d.x1, d.x2);
    const y1 = Math.min(d.y1, d.y2);
    const x2 = Math.max(d.x1, d.x2);
    const y2 = Math.max(d.y1, d.y2);
    addManual({
      x: Math.round((x1 / 100) * frame.width),
      y: Math.round((y1 / 100) * frame.height),
      w: Math.round(((x2 - x1) / 100) * frame.width),
      h: Math.round(((y2 - y1) / 100) * frame.height),
    });
  };

  return (
    <div
      data-testid="photo-review-overlay"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 p-2"
      role="dialog"
      aria-modal="true"
      aria-label="Review the notes found in your photo"
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
          className="relative overflow-hidden"
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
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
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
            {notes.map((s, i) => (
              <NoteBox
                key={s.id}
                note={s}
                frame={frame}
                text={textOf(s.id)}
                reading={reading}
                ticked={ticked.has(s.id)}
                // A box the author DREW appears at once; only the detector's own
                // are revealed one at a time.
                shown={i >= detected.length || i < revealed}
                onToggle={() => toggle(s.id)}
                onEdit={(value) => editText(s.id, value)}
                zoom={photoView.view.zoom}
              />
            ))}
            {drawing ? (
              <div
                aria-hidden
                className="pointer-events-none absolute border-2 border-dashed border-white"
                style={{
                  left: `${Math.min(drawing.x1, drawing.x2)}%`,
                  top: `${Math.min(drawing.y1, drawing.y2)}%`,
                  width: `${Math.abs(drawing.x2 - drawing.x1)}%`,
                  height: `${Math.abs(drawing.y2 - drawing.y1)}%`,
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
        />
      </div>

      {/* The two ways out, floating over the dimmed margin below the photo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-3">
        <p className="pointer-events-auto rounded-full bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur">
          {detecting
            ? 'Finding the stickies…'
            : `${ticked.size} of ${notes.length} · drag the photo to add one`}
        </p>
        {detection ? (
          <TruthExport
            photoName={review.photoName}
            size={detection.imageSize}
            notes={notes}
            ticked={ticked}
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
          disabled={ticked.size === 0}
          className="pointer-events-auto rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-600 disabled:opacity-50"
        >
          Add {ticked.size} {ticked.size === 1 ? 'note' : 'notes'}
        </button>
      </div>
    </div>
  );
}
