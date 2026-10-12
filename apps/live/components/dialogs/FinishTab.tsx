'use client';

// The Tab Style dialog's Finish tab (docs/specs/008-canvas/finish.md "Where it is set"): the tab's
// finish as three tiles, applied live, and Apply to All Elements, which clears every element's own finish so
// the whole tab follows it again.

import { DEFAULT_FINISH, FINISHES, type Finish } from '@livediagram/document';
import { Button } from '@livediagram/ui';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { TabStylePreview } from './TabStylePreview';

export function FinishTab({
  finish,
  onSetFinish,
  onApplyFinishToAll,
  canvasBackground,
  themeId,
  font,
}: {
  // The tab's finish; undefined reads as Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  onApplyFinishToAll: () => void;
  // The tab's own background (undefined: the canvas's default for this surface), theme and font, so the
  // preview sits on the same paper in the same look.
  canvasBackground: string | undefined;
  themeId: string;
  font: string | null;
}) {
  const current = finish ?? DEFAULT_FINISH;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Finish
        </span>
        <div role="radiogroup" aria-label="Finish" className="grid grid-cols-3 gap-2">
          {FINISHES.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={current === f}
              onClick={() => onSetFinish(f)}
              className={`flex flex-col items-center gap-2 rounded-lg border px-2 pb-2.5 pt-3.5 transition ${
                current === f
                  ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60'
              }`}
            >
              {/* Big enough to see the corner, line weight and wobble change between the three. */}
              <FinishSwatch finish={f} size={40} />
              <span className="text-[12px] font-semibold">{FINISH_LABELS[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Preview
        </span>
        <TabStylePreview
          finish={current}
          canvasBackground={canvasBackground}
          themeId={themeId}
          font={font}
          label={`A sample diagram drawn in the ${FINISH_LABELS[current]} finish`}
        />
      </div>
      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button variant="secondary" size="xs" onClick={onApplyFinishToAll}>
          Apply to All Elements
        </Button>
      </div>
    </div>
  );
}
