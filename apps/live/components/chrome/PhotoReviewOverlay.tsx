'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { classifyRgb, wallFloorsOf, type DetectedSticky } from '@livediagram/sticky-vision';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';

// Step 1 + 2 of the photo review wizard (spec/139 Phase 9): the photo with
// every detected box drawn over it, tickable, the words per note editable, and
// a drag that draws a box around a MISSED sticky to add it by hand. Nothing
// here writes — Add hands the ticked boxes, the drawn boxes and the edited
// words to the hook, which is the one place the draft lands.

const KIND_META = new Map(EVENT_STORMING_NOTES.map((n) => [n.kind, n]));
const fillOf = (kind: string): string => KIND_META.get(kind as never)?.fill ?? '#cbd5e1';
const labelOf = (kind: string): string => KIND_META.get(kind as never)?.label ?? kind;
const sizeOf = (kind: string): 'square' | 'wide' | 'small' =>
  KIND_META.get(kind as never)?.size ?? 'square';

// The dominant paper colour inside a box the author drew, classified against
// the notation's own fills. Wall, ink and unknown pixels are ignored; the note
// kind is the colour that actually fills the box.
function kindOfBox(
  imageData: Uint8ClampedArray,
  imageSize: { width: number; height: number },
  box: { x: number; y: number; w: number; h: number },
): EventStormingNoteKind {
  const floors = wallFloorsOf({
    width: imageSize.width,
    height: imageSize.height,
    data: imageData,
  });
  const votes = new Map<string, number>();
  const x1 = Math.min(imageSize.width, box.x + box.w);
  const y1 = Math.min(imageSize.height, box.y + box.h);
  for (let y = box.y; y < y1; y += 3) {
    for (let x = box.x; x < x1; x += 3) {
      const i = (y * imageSize.width + x) * 4;
      const c = classifyRgb(imageData[i]!, imageData[i + 1]!, imageData[i + 2]!, floors);
      if (c === 'wall' || c === 'ink' || c === 'unknown') continue;
      votes.set(c, (votes.get(c) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [kind, count] of votes) {
    if (count > bestCount) {
      bestCount = count;
      best = kind;
    }
  }
  return (best as EventStormingNoteKind | null) ?? 'domain-event';
}

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
  // derived from a detection has to hold for "not yet". The 1x1 stand-in size
  // is never used to place a box (there are none until detection lands); it
  // only keeps the percentage maths total.
  const detection = review.detection;
  const detected = detection?.stickies ?? [];
  const { width, height } = detection?.imageSize ?? { width: 1, height: 1 };
  // Still looking. Distinct from "looked and found nothing", which is advice.
  const detecting = detection === null;
  const foundNothing = detection !== null && detected.length === 0;
  // Everything found is ticked: the common case is "add the wall", and making
  // the author tick thirty boxes to get there would be a toll gate.
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(detected.map((s) => s.id)));
  // The overlay MOUNTS before the detector has answered, so seeding the set
  // once at mount seeds it from nothing: the boxes then arrive unticked and
  // the button reads "Add 0 notes" over a wall full of them. Tick each
  // detection as it lands instead.
  useEffect(() => {
    setTicked(new Set(detected.map((s) => s.id)));
    // Identity of the detection, not of the array: this must run once when the
    // answer arrives, and never again on a re-render that ticks a box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection]);
  // The author's edits only; every unedited field streams straight from the
  // review as the words arrive, so the fields fill in without a re-mount.
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
  // Detection is revealed one box at a time, at most two a second, so the
  // author can see the wall being read rather than a sudden result (spec/139
  // Phase 9). The reveal is purely presentational — every box is there from
  // the start, hidden until its turn.
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
    }, 500);
    return () => clearInterval(id);
  }, [detected.length]);

  const textOf = (id: number): string => edited.get(id) ?? review.textById.get(id)?.text ?? '';

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
    if (box.w < 0.02 * width || box.h < 0.02 * height) return; // a click, not a box
    const id = manualId.current;
    manualId.current -= 1;
    if (!detection) return;
    const kind = kindOfBox(detection.imageData, detection.imageSize, box);
    const note: DetectedSticky = {
      id,
      kind,
      size: sizeOf(kind),
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      row: 0,
      order: 0,
      confidence: 1,
    };
    setManual((prev) => [...prev, note]);
    setTicked((prev) => new Set(prev).add(id));
  };

  const confirm = () => {
    const texts = new Map<number, { text: string; legible: boolean }>();
    for (const s of notes) {
      const text = textOf(s.id);
      texts.set(s.id, { text, legible: text.trim() !== '' });
    }
    const detectedTicked = new Set(detected.filter((s) => ticked.has(s.id)).map((s) => s.id));
    onConfirm(
      detectedTicked,
      texts,
      manual.filter((m) => ticked.has(m.id)),
    );
  };

  // The photo area: drag on it (not on a box) to draw a missed sticky.
  const photoRef = useRef<HTMLDivElement | null>(null);
  const point = (e: PointerEvent<HTMLDivElement>) => {
    const rect = photoRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
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
  const onPointerUp = () => {
    const d = drawingRef.current;
    if (!d) return;
    drawingRef.current = null;
    setDrawing(null);
    const x1 = Math.min(d.x1, d.x2);
    const y1 = Math.min(d.y1, d.y2);
    const x2 = Math.max(d.x1, d.x2);
    const y2 = Math.max(d.y1, d.y2);
    addManual({
      x: Math.round((x1 / 100) * width),
      y: Math.round((y1 / 100) * height),
      w: Math.round(((x2 - x1) / 100) * width),
      h: Math.round(((y2 - y1) / 100) * height),
    });
  };

  return (
    <div
      data-testid="photo-review-overlay"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Review the notes found in your photo"
    >
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Step 1: the photo with every box, and drag to draw a missed one. */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div
            ref={photoRef}
            className="relative cursor-crosshair select-none overflow-hidden rounded-lg shadow-2xl"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              src={review.photoUrl}
              alt="The photographed wall"
              draggable={false}
              className="block h-auto w-auto max-h-[90vmin] max-w-[90vmin]"
            />
            {notes.map((s, i) => {
              const active = ticked.has(s.id);
              const detectedOne = i < detected.length;
              const shown = !detectedOne || i < revealed;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${labelOf(s.kind)} note, ${active ? 'ticked' : 'not ticked'}`}
                  onClick={() => toggle(s.id)}
                  className="absolute rounded-sm border-2 transition-all duration-300"
                  style={{
                    left: `${(s.x / width) * 100}%`,
                    top: `${(s.y / height) * 100}%`,
                    width: `${(s.w / width) * 100}%`,
                    height: `${(s.h / height) * 100}%`,
                    borderColor: fillOf(s.kind),
                    background: `${fillOf(s.kind)}22`,
                    opacity: shown ? (active ? 1 : 0.35) : 0,
                    transform: shown ? 'scale(1)' : 'scale(0.8)',
                  }}
                >
                  <span
                    className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-900"
                    style={{ background: fillOf(s.kind) }}
                  >
                    {labelOf(s.kind)}
                  </span>
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                    {Math.round(s.confidence * 100)}%
                  </span>
                </button>
              );
            })}
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

        {/* Step 2: the words, editable. */}
        <aside className="flex w-80 flex-col gap-2 overflow-y-auto rounded-lg bg-white/95 p-3 dark:bg-slate-900/95">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {detecting
              ? 'Your photo is here. Finding the stickies in it…'
              : 'Drag on the photo to add a sticky the detector missed.'}
          </p>
          {detecting ? (
            <p
              data-testid="photo-finding"
              aria-live="polite"
              className="flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400"
              />
              Finding the stickies…
            </p>
          ) : null}
          {foundNothing ? (
            <p
              data-testid="photo-found-nothing"
              className="rounded bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
            >
              No stickies found in this photo. Fill the frame with the wall, shoot straight on, and
              give it good light — then try another photo. You can still drag a box around a note to
              add it by hand.
            </p>
          ) : null}
          {revealed < detected.length ? (
            <p className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Detecting… {revealed} of {detected.length}
            </p>
          ) : null}
          {reading ? (
            <p className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Reading the words…
            </p>
          ) : null}
          {review.readError ? (
            <p className="rounded bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              The reader could not finish ({review.readError}). Type the words in yourself.
            </p>
          ) : null}
          {notes.map((s, i) => (
            <label
              key={s.id}
              className={`flex items-start gap-2 rounded-md border p-2 ${
                ticked.has(s.id) ? 'border-slate-300 dark:border-slate-600' : 'opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={ticked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="mt-1"
                aria-label={`Include note ${i + 1}`}
              />
              <span
                className="mt-1 h-3 w-3 flex-none rounded-sm"
                style={{ background: fillOf(s.kind) }}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {labelOf(s.kind)} · row {s.row}
                </span>
                <input
                  type="text"
                  value={textOf(s.id)}
                  onChange={(e) => editText(s.id, e.target.value)}
                  placeholder={reading ? '…' : 'Type the words…'}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </span>
            </label>
          ))}
        </aside>
      </div>

      {/* The two ways out. */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <p className="text-sm text-slate-200">
          {ticked.size} of {notes.length} notes
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/30 px-4 py-1.5 text-sm text-slate-200 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={ticked.size === 0}
            className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Add {ticked.size} {ticked.size === 1 ? 'note' : 'notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
