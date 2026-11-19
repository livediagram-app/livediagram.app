'use client';

// The Tab Style dialog's Finish panel (each product's docs/specs/008-canvas/finish.md "Where it is set"): the tab's
// finish as four tiles, applied live to the tab and every element on it (each follows the tab again), over the
// product's preview of its sample in the chosen finish.

import type { ReactNode } from 'react';
import { DEFAULT_FINISH, FINISHES, type Finish } from '@liveworkspace/element-model/finish';
import { SECTION_LABEL } from './LooksHome';
import type { TabStyleProfile, TabStyleLook, TabStylePreviewProps } from './tab-style-profile';

export function FinishPanel<Look extends TabStyleLook, Pattern extends string>({
  profile,
  finish,
  onSetFinish,
  renderPreview,
}: {
  profile: Pick<TabStyleProfile<Look, Pattern>, 'finishLabels' | 'FinishSwatch'>;
  // The tab's finish; undefined reads as Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  // The product's preview, drawn in the finish on show.
  renderPreview: (props: Pick<TabStylePreviewProps, 'finish' | 'finishLabel'>) => ReactNode;
}) {
  const current = finish ?? DEFAULT_FINISH;
  const { finishLabels, FinishSwatch } = profile;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={SECTION_LABEL}>Finish</span>
        <div
          role="radiogroup"
          aria-label="Finish"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
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
              {/* Big enough to see the corner, line weight and wobble change between the four. */}
              <FinishSwatch finish={f} size={40} />
              <span className="text-[12px] font-semibold">{finishLabels[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={SECTION_LABEL}>Preview</span>
        {renderPreview({ finish: current, finishLabel: finishLabels[current] })}
      </div>
    </div>
  );
}
