'use client';

// The Export dialog's GIF panel (docs/specs/020-import-export/animated-gif-export.md "The options"): the pages, how
// long each holds, the size, the deck's transition, the estimate and a still preview, then the making, with its
// progress and Cancel. Loaded only when the GIF card opens.
import { useEffect } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { LaidOutPage, Tab } from '@livedocuments/document';
import { ACTIVE_SEGMENT, Button, SEGMENT_TRACK } from '@livedocuments/ui';
import { BackBar } from '@liveworkspace/workbench/components/primitives/BackBar';
import { SegmentSlider } from '@liveworkspace/workbench/components/primitives/SegmentSlider';
import { holdLabel, holdValueText } from '@/lib/gif-export/gif-estimate';
import type { GifExportErrorCode } from '@/lib/gif-export/gif-export-error';
import {
  GIF_HOLD_MAX_S,
  GIF_HOLD_MIN_S,
  GIF_HOLD_STEP_S,
  GIF_LARGE_BYTES,
  GIF_SIZES,
  gifSizeLabel,
} from '@/lib/gif-export/gif-timeline';
import { SLIDE_SPEEDS, SLIDE_TRANSITIONS } from '@/lib/presentation-config';
import { ExportPagePicker } from '../ExportPagePicker';
import { useGifExport } from './useGifExport';

export const GIF_ERROR_COPY: Record<GifExportErrorCode, string> = {
  tainted:
    "This Browser couldn't draw the page into a GIF. Try Chrome, Edge or Firefox, or export a PNG.",
  'page-missing': 'That page is no longer in the tab.',
  failed: "Couldn't make the GIF. Try a smaller size or a shorter hold.",
};
export const GIF_TOO_LONG_COPY =
  'Too long for a GIF: keep it under 3 minutes by shortening the hold or exporting one page.';
export const GIF_LARGE_COPY = 'Large for chat and email: try Small or a shorter hold.';

export default function GifExportPanel({
  tab,
  pages,
  page,
  baseName,
  onPick,
  onDone,
  onBack,
  onClearSelection,
}: {
  tab: Tab;
  pages: readonly LaidOutPage[];
  page: LaidOutPage;
  baseName: string;
  onPick: (index: number) => void;
  onDone: () => void;
  onBack: () => void;
  // The GIF is drawn from the canvas as it stands, so a selection would ring an element in every frame
  // (docs/specs/020-import-export/animated-gif-export.md "What a frame shows"): it is cleared as the panel opens.
  onClearSelection?: () => void;
}) {
  const clear = useLatest(onClearSelection);
  useEffect(() => clear.current?.(), [clear]);
  const gif = useGifExport({ tab, pages, page, baseName, onDone });
  const making = gif.phase.kind === 'making';
  const percent = gif.phase.kind === 'making' ? Math.round(gif.phase.progress * 100) : 0;
  const sizeIndex = GIF_SIZES.findIndex((s) => s.id === gif.size);
  const transitionLabel = SLIDE_TRANSITIONS.find((t) => t.id === gif.transition)?.label ?? 'Slide';
  const speedLabel = SLIDE_SPEEDS.find((s) => s.id === gif.speed)?.label ?? 'Normal';

  return (
    <div>
      <BackBar label="All formats" current="GIF" onClick={onBack} disabled={making} />
      <fieldset disabled={making} className="m-0 min-w-0 border-0 p-0">
        <div className="mt-3">
          <ExportPagePicker
            pages={pages}
            page={page}
            scope={gif.scope}
            format="gif"
            onScope={gif.setScope}
            onPick={onPick}
          />
        </div>
        {/* The page as the GIF opens, still. */}
        <div className="my-4 flex h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
          {gif.estimate ? (
            <img
              data-testid="export-preview"
              src={gif.estimate.previewUrl}
              alt="The page as the GIF opens"
              className="max-h-[176px] w-auto max-w-full bg-white object-contain"
            />
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">Preparing preview…</span>
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
          <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span className="w-28 shrink-0">Each page holds</span>
            <input
              type="range"
              min={GIF_HOLD_MIN_S}
              max={GIF_HOLD_MAX_S}
              step={GIF_HOLD_STEP_S}
              value={gif.holdSeconds}
              aria-valuetext={holdValueText(gif.holdSeconds)}
              onChange={(e) => gif.setHoldSeconds(Number(e.target.value))}
              className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700"
            />
            <span className="w-10 text-right font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {holdLabel(gif.holdSeconds)}
            </span>
          </label>
          <div className="flex items-center gap-3">
            <span
              id="gif-size-label"
              className="w-28 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Size
            </span>
            <div
              role="radiogroup"
              aria-labelledby="gif-size-label"
              className={`relative grid w-56 grid-cols-3 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
            >
              <SegmentSlider
                count={GIF_SIZES.length}
                index={sizeIndex}
                className={ACTIVE_SEGMENT}
              />
              {GIF_SIZES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={gif.size === id}
                  onClick={() => gif.setSize(id)}
                  className={`relative z-10 rounded-md py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
                    gif.size === id
                      ? 'text-white'
                      : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {gif.loops ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Between pages:{' '}
              {gif.transition === 'none' ? transitionLabel : `${transitionLabel}, ${speedLabel}`},
              from the Slide Deck settings.
            </p>
          ) : null}
        </div>
      </fieldset>
      <div className="mt-3 min-h-5 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {gif.tooLong ? (
          <p className="text-amber-700 dark:text-amber-300">{GIF_TOO_LONG_COPY}</p>
        ) : gif.estimate ? (
          <p>
            {gifSizeLabel(gif.estimate.bytes)}
            {gif.estimate.bytes > GIF_LARGE_BYTES ? `. ${GIF_LARGE_COPY}` : null}
          </p>
        ) : null}
      </div>
      {gif.phase.kind === 'error' ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {GIF_ERROR_COPY[gif.phase.code]}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        {making ? (
          <>
            <div
              role="progressbar"
              aria-label="Making the GIF"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
                style={{ width: `${percent}%` }}
              />
            </div>
            <Button variant="secondary" size="md" onClick={gif.cancel}>
              Cancel
            </Button>
          </>
        ) : null}
        <Button
          variant="primary"
          size="md"
          onClick={() => void gif.make()}
          disabled={making || gif.tooLong}
        >
          {making ? `Making GIF… ${percent}%` : 'Download GIF'}
        </Button>
      </div>
    </div>
  );
}
