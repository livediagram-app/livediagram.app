'use client';

// Describe Structure beside the floating page buttons (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe
// Structure on a page"): to the left of Edit on a page with nothing written, and of Cancel while its draft has nothing
// under the Title. Calm and secondary beside them (Cancel's white, the floating buttons' shape), with the sparkle
// Describe to Set Up uses. Its name is its label, so it has no tooltip, as Edit, Cancel and Save have none. It only
// opens the dialog; the dialog's code is fetched then (DescribeStructureHost.tsx).
import { lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';
import { STRUCTURE_BUTTON } from '@/lib/describe-structure/structure-words';

// The floating buttons' glyph size.
const SparkleIcon = lucideGlyph(lucideSparkles, 14);

const BUTTON =
  'lk-pop-in inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white pl-3 pr-3.5 text-[13px] font-semibold text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 motion-safe:transition-colors motion-safe:duration-micro hover:bg-brand-50 hover:text-brand-900 hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:h-11 dark:bg-slate-800 dark:text-slate-200 dark:shadow-black/40 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-white dark:hover:ring-brand-400/50';

export function DescribeStructureButton({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} data-describe-structure="" className={BUTTON}>
      <span aria-hidden className="text-brand-700 dark:text-brand-300">
        <SparkleIcon />
      </span>
      {STRUCTURE_BUTTON}
    </button>
  );
}
