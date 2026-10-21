'use client';

// The Tab Style dialog's Finish panel (docs/specs/008-canvas/finish.md "Where it is set"): the tab's finish as four
// tiles, applied live to the tab and every element on it (each follows the tab again), and a preview of the sample in
// the chosen finish.

import { DEFAULT_FINISH, FINISHES, type Finish } from '@liveplanner/document';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { TabStylePreview } from './TabStylePreview';

export function FinishTab({
  finish,
  onSetFinish,
  canvasBackground,
  themeId,
  font,
}: {
  // The tab's finish; undefined reads as Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
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
        <div
          role="radiogroup"
          aria-label="Finish"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {FINISHES.map((f) => (
            <FinishTile key={f} finish={f} active={current === f} onPick={() => onSetFinish(f)} />
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
    </div>
  );
}

function FinishTile({
  finish,
  active,
  onPick,
}: {
  finish: Finish;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={`flex flex-col items-center gap-2 rounded-lg border px-2 pb-2.5 pt-3.5 transition ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60'
      }`}
    >
      {/* Big enough to see the corner, line weight and wobble change between the four. */}
      <FinishSwatch finish={finish} size={40} />
      <span className="text-[12px] font-semibold">{FINISH_LABELS[finish]}</span>
    </button>
  );
}
