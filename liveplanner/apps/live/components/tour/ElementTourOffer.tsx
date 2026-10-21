'use client';

// The element tour offer (docs/specs/007-editor/element-tours.md "The tour offer"): a small toolbar beside the
// selection toolbar, the Tour glyph and word, then Play and Cancel. It only draws what ElementTourHost publishes.
import {
  CloseIcon,
  HoverCard,
  lucideGlyph,
  SOLID_BRAND_DARK_CONTROL,
  withArticle,
} from '@liveplanner/ui';
import { lucideFootprints } from '@liveplanner/icons/lucide';
import { PlayIcon } from '@/components/primitives/PlayIcon';
import type { ElementTourOffer as Offer } from '@/lib/element-tour-offer';
import { ELEMENT_TOUR_NAMES } from '@/lib/element-tours';

// Show Me's footprints: the one glyph for a walkthrough.
const FootprintsIcon = lucideGlyph(lucideFootprints, 14);

const BUTTON =
  'relative flex h-8 w-8 items-center justify-center rounded-md transition touch-target-y';

export function ElementTourOffer({ offer }: { offer: Offer }) {
  const name = ELEMENT_TOUR_NAMES[offer.kind];
  return (
    <div
      role="toolbar"
      aria-label={`Show Me for this ${name}`}
      data-testid="element-tour-offer"
      className="pointer-events-auto flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <span className="flex h-8 items-center gap-1.5 pl-1.5 pr-1 text-[12px] font-medium text-slate-600 dark:text-slate-300">
        <FootprintsIcon />
        <span>Show Me</span>
      </span>
      <HoverCard
        title="Show Me"
        description={`A short walkthrough of how ${withArticle(name)} works, on this one.`}
      >
        <button
          type="button"
          onClick={offer.play}
          aria-label="Show Me"
          className={`${BUTTON} bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
        >
          <PlayIcon size={12} />
        </button>
      </HoverCard>
      <HoverCard
        title="No Thanks"
        description="Hide this. Settings › Tours › Show Me offers it again."
      >
        <button
          type="button"
          onClick={offer.dismiss}
          aria-label="No Thanks"
          className={`${BUTTON} text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white`}
        >
          <CloseIcon />
        </button>
      </HoverCard>
    </div>
  );
}
