'use client';

// The Photo panel's always-shown overview and its History (docs/specs/031-photo/photo-pages.md "The Photo panel"):
// a card with the composite's histogram (luminosity, or red, green and blue overlaid, a two-way switch), the photo's
// size, and the pixel under the pointer with its colour as a swatch; and the History, a timeline of this session's
// edits, each with its kind's glyph, the current one marked Now (a press steps back or forward to an edit; the
// undone ones dimmed).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  lucideBrush,
  lucideCrop,
  lucideHistory,
  lucideImage,
  lucideLayers,
  lucideMove,
  lucidePaintBucket,
  lucideSlidersHorizontal,
  lucideSparkles,
  lucideSquareDashed,
  lucideType,
  lucideWand,
} from '@liveworkspace/icons/lucide';
import { CompactEmptyState, lucideGlyph } from '@livedesign/ui';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { PhotoHistory } from '@/lib/photo-editor/photo-history';
import { usePhotoPointer } from '@/lib/photo-editor/photo-pointer';
import { pickColour } from '@/lib/photo-editor/tools/fill-tools';
import { histogramPath, usePhotoHistogram } from './usePhotoHistogram';

const HistoryIcon = lucideGlyph(lucideHistory, 20);

/** The composite's histogram, size and the pixel under the pointer, in one card. */
export function PhotoOverview({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const hist = usePhotoHistogram(photo);
  const [colours, setColours] = useState(false);
  const at = usePhotoPointer();
  const ctx = photo.ctx;
  const W = ctx?.session.photo.width ?? 0;
  const H = ctx?.session.photo.height ?? 0;
  const inside = !!at && !!ctx && at.x >= 0 && at.y >= 0 && at.x < W && at.y < H;
  const colour = inside ? pickColour(ctx, at, 1, true) : null;
  return (
    <div className="mx-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/80 dark:bg-slate-800/50 dark:ring-slate-700">
      <div className="relative">
        <svg
          viewBox="0 0 256 64"
          preserveAspectRatio="none"
          className="h-20 w-full rounded-lg bg-white dark:bg-slate-900"
          role="img"
          aria-label="Histogram"
        >
          <defs>
            <linearGradient id="photo-hist-luma" x1="0" x2="1">
              <stop offset="0" stopColor="#0f172a" />
              <stop offset="1" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          {[64, 128, 192].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={0}
              y2={64}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              className="stroke-slate-200 dark:stroke-slate-700"
            />
          ))}
          {colours ? (
            <>
              <path d={histogramPath(hist?.red)} fill="rgb(239 68 68 / 0.45)" />
              <path d={histogramPath(hist?.green)} fill="rgb(34 197 94 / 0.45)" />
              <path d={histogramPath(hist?.blue)} fill="rgb(59 130 246 / 0.45)" />
            </>
          ) : (
            <path d={histogramPath(hist?.luma)} fill="url(#photo-hist-luma)" opacity={0.85} />
          )}
        </svg>
        <div
          role="radiogroup"
          aria-label="Histogram Channels"
          className="absolute right-1.5 top-1.5 flex rounded-md bg-white/90 p-0.5 text-[10px] font-semibold shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/90 dark:ring-slate-700"
        >
          {(
            [
              [false, 'Luma'],
              [true, 'RGB'],
            ] as const
          ).map(([on, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={colours === on}
              onClick={() => setColours(on)}
              className={`rounded px-1.5 py-0.5 transition ${
                colours === on
                  ? 'bg-brand-700 text-white dark:bg-brand-600'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-600 dark:text-slate-300"
        aria-live="off"
      >
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {W} × {H}
        </span>
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">px</span>
        <span className="flex-1" />
        {inside ? (
          <>
            <span className="text-slate-500 dark:text-slate-400">
              {Math.floor(at.x)}, {Math.floor(at.y)}
            </span>
            <span
              aria-hidden
              className="h-4 w-4 rounded ring-1 ring-slate-300 dark:ring-slate-600"
              style={{
                background:
                  colour ?? 'repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 6px 6px',
              }}
            />
            <span className="font-mono text-[11px] uppercase text-slate-700 dark:text-slate-200">
              {colour ?? 'clear'}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">Point at the photo</span>
        )}
      </div>
    </div>
  );
}

// An edit's glyph, by the words its name starts with.
const KINDS: readonly [RegExp, ReturnType<typeof lucideGlyph>][] = [
  [
    /^(Brush|Pencil|Eraser|Background Eraser|Clone|Heal|Spot|Blur|Sharpen|Smudge|Dodge|Burn|Sponge|Red Eye)/,
    lucideGlyph(lucideBrush, 13),
  ],
  [/^(Gradient|Paint Bucket|Fill)/, lucideGlyph(lucidePaintBucket, 13)],
  [/^(Text)/, lucideGlyph(lucideType, 13)],
  [/^(Crop|Canvas Size|Image Size|Trim)/, lucideGlyph(lucideCrop, 13)],
  [/^(Move|Free Transform|Transform|Rotate|Flip|Align)/, lucideGlyph(lucideMove, 13)],
  [/^(Select|Deselect|Quick|Magic|Lasso)/, lucideGlyph(lucideSquareDashed, 13)],
  [
    /(Filter|Blur$|Noise|Stylize|Pixelate|Distort|Render|Sharpen$)/,
    lucideGlyph(lucideSparkles, 13),
  ],
  [
    /^(Levels|Curves|Brightness|Exposure|Vibrance|Hue|Colour|White|Black|Photo Filter|Channel|Selective|Gradient Map|Invert|Posterize|Threshold|Auto|Reset)/,
    lucideGlyph(lucideSlidersHorizontal, 13),
  ],
  [/^(Open|Place|Paste)/, lucideGlyph(lucideImage, 13)],
  [/Remove Background|Subject/, lucideGlyph(lucideWand, 13)],
];
const LayerGlyph = lucideGlyph(lucideLayers, 13);
const glyphFor = (label: string) => KINDS.find(([re]) => re.test(label))?.[1] ?? LayerGlyph;

export function PhotoHistoryTab({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const h = photo.history;
  const entries = useSyncExternalStore(
    (fn) => h.subscribe(fn),
    () => h.entries,
    () => h.entries,
  );
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [entries.length]);
  if (!entries.length)
    return (
      <CompactEmptyState
        icon={<HistoryIcon />}
        title="No edits yet"
        description="Each edit to the photo this session is listed here."
      />
    );
  return (
    <div className="flex min-h-0 flex-col gap-1.5 px-3 pb-2">
      <p className="px-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        Press an edit to step back to it; the next edit drops what comes after.
      </p>
      <ol ref={list} aria-label="History" className="relative max-h-80 overflow-y-auto py-0.5">
        {entries.map((e, i) => {
          const undone = PhotoHistory.undone(e, photo.depth);
          const here =
            !undone &&
            (i === entries.length - 1 || PhotoHistory.undone(entries[i + 1]!, photo.depth));
          const Glyph = glyphFor(e.label);
          return (
            <li key={`${e.depth}-${i}`} className="relative">
              {/* The timeline's thread, through each step's dot. */}
              <span
                aria-hidden
                className={`absolute left-[15px] w-px bg-slate-200 dark:bg-slate-700 ${
                  i === 0 ? 'top-1/2' : 'top-0'
                } ${i === entries.length - 1 ? 'bottom-1/2' : 'bottom-0'}`}
              />
              <button
                type="button"
                aria-current={here ? 'step' : undefined}
                onClick={() => photo.stepHistory(PhotoHistory.stepsTo(e, photo.depth))}
                className={`relative flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-[12.5px] transition ${
                  here
                    ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                    : undone
                      ? 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${
                    here
                      ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600 dark:ring-brand-600'
                      : undone
                        ? 'bg-white text-slate-300 ring-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:ring-slate-700'
                        : 'bg-white text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                  }`}
                >
                  <Glyph />
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${undone ? 'line-through decoration-slate-300' : ''}`}
                >
                  {e.label}
                </span>
                {here ? (
                  <span className="shrink-0 rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white dark:bg-brand-600">
                    Now
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
