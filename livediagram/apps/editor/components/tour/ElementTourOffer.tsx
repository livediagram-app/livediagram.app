'use client';

// The element tour's Play button (docs/specs/007-editor/element-tours.md "The Play button"): a small toolbar beside
// the selection toolbar: Play, then an X that dismisses it. No hover cards. It only draws what ElementTourHost
// publishes.
import { CloseIcon, lucideGlyph, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { lucidePlay } from '@liveworkspace/icons/lucide';
import type { ElementTourOffer as Offer } from '@/lib/element-tour-offer';
import { ELEMENT_TOUR_NAMES } from '@/lib/element-tours';

const PlayGlyph = lucideGlyph(lucidePlay, 12);

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition touch-target-y';

export function ElementTourOffer({ offer }: { offer: Offer }) {
  const name = ELEMENT_TOUR_NAMES[offer.kind];
  return (
    <div
      role="toolbar"
      aria-label={`Show Me for this ${name}`}
      data-testid="element-tour-offer"
      className="pointer-events-auto flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <button
        type="button"
        onClick={offer.play}
        aria-label={`Play the ${name} walkthrough`}
        className={`${BUTTON} bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
      >
        <PlayGlyph />
      </button>
      <button
        type="button"
        onClick={offer.dismiss}
        aria-label={`Dismiss the ${name} walkthrough`}
        className={`${BUTTON} text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
