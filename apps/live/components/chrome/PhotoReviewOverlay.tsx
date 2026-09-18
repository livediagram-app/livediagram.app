'use client';

import { useState } from 'react';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';

// Step 1 + 2 of the photo review wizard (spec/139 Phase 9): the photo with
// every detected box drawn over it, tickable, and the words per note, editable.
// Nothing here writes — Add hands the ticked boxes and the edited words to the
// hook, which is the one place the draft lands. The photo is a local JPEG in
// memory; it is never stored or sent.

const KIND_META = new Map(EVENT_STORMING_NOTES.map((n) => [n.kind, n]));
const fillOf = (kind: string): string => KIND_META.get(kind as never)?.fill ?? '#cbd5e1';
const labelOf = (kind: string): string => KIND_META.get(kind as never)?.label ?? kind;

export function PhotoReviewOverlay({
  review,
  onConfirm,
  onCancel,
}: {
  review: PhotoReview;
  onConfirm: (ticked: Set<number>, texts: Map<number, { text: string; legible: boolean }>) => void;
  onCancel: () => void;
}) {
  const stickies = review.detection.stickies;
  const { width, height } = review.detection.imageSize;
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(stickies.map((s) => s.id)));
  const [texts, setTexts] = useState<Map<number, { text: string; legible: boolean }>>(
    () => new Map(review.textById),
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
    setTexts((prev) => {
      const next = new Map(prev);
      next.set(id, { text: value, legible: value.trim() !== '' });
      return next;
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
        {/* Step 1: the photo with every box. */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div
            className="relative overflow-hidden rounded-lg shadow-2xl"
            style={{ aspectRatio: `${width} / ${height}`, maxWidth: '100%', maxHeight: '100%' }}
          >
            <img
              src={review.detection.photoUrl}
              alt="The photographed wall"
              className="absolute inset-0 h-full w-full object-fill"
            />
            {stickies.map((s) => {
              const active = ticked.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${labelOf(s.kind)} note, ${active ? 'ticked' : 'not ticked'}`}
                  onClick={() => toggle(s.id)}
                  className="absolute rounded-sm border-2 transition-opacity"
                  style={{
                    left: `${(s.x / width) * 100}%`,
                    top: `${(s.y / height) * 100}%`,
                    width: `${(s.w / width) * 100}%`,
                    height: `${(s.h / height) * 100}%`,
                    borderColor: fillOf(s.kind),
                    background: `${fillOf(s.kind)}22`,
                    opacity: active ? 1 : 0.35,
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
          </div>
        </div>

        {/* Step 2: the words, editable. */}
        <aside className="flex w-80 flex-col gap-2 overflow-y-auto rounded-lg bg-white/95 p-3 dark:bg-slate-900/95">
          {review.readError ? (
            <p className="rounded bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              The reader could not finish ({review.readError}). Type the words in yourself.
            </p>
          ) : null}
          {stickies.map((s, i) => (
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
                  value={texts.get(s.id)?.text ?? ''}
                  onChange={(e) => editText(s.id, e.target.value)}
                  placeholder="Type the words…"
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
          {ticked.size} of {stickies.length} notes
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
            onClick={() => onConfirm(ticked, texts)}
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
