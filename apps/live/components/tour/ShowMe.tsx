'use client';

// Show Me (docs/specs/007-editor/show-me.md): the button that starts a tour of one surface, there and then, and the
// tour drawn over that surface. Never offered: only the button runs it. Each surface keeps its own steps and its own
// literal telemetry (so the dashboard's emitter scan reads them); these are the parts every Show Me shares.
import { useRef } from 'react';
import { lucideGlyph } from '@livediagram/ui';
import { lucideFootprints } from '@livediagram/icons/lucide';
import { helpArticleHref, type HelpArticleKey } from '@/lib/help-articles';
import { TourStage } from './TourStage';
import type { TourEngine } from './useTourEngine';

// A walkthrough's footprints, at the Help link's size.
const FootprintsIcon = lucideGlyph(lucideFootprints, 14);

// The header's Show Me, left of Help and drawn as it is (HelpArticleLink's labelled variant). `onStart` sends the
// surface's own Started event, and may return a promise (steps loaded at the press) that the tour waits for; a press
// while the tour runs, or while its steps are still loading, does nothing. Steps that fail to load (a dropped
// connection) leave the button as it was, to be pressed again.
export function ShowMeButton<Api>({
  tour,
  onStart,
}: {
  tour: TourEngine<Api>;
  onStart: () => void | Promise<void>;
}) {
  const loading = useRef(false);
  return (
    <button
      type="button"
      aria-pressed={tour.active}
      className="relative touch-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      onClick={() => {
        if (tour.active || loading.current) return;
        const ready = onStart();
        if (!ready) return tour.start();
        loading.current = true;
        void ready
          .then(tour.start, () => {})
          .finally(() => {
            loading.current = false;
          });
      }}
    >
      <FootprintsIcon />
      {/* The glyph alone on a phone, where a dialog's header has no room for the words beside its close button. */}
      <span className="max-sm:sr-only">Show Me</span>
    </button>
  );
}

// The running tour: the ring around each step's real control and the step card, the closing card linking `article`
// as `helpLabel` ("Card Types Help"). `layer` 'modal' rings controls inside a dialog; 'overlay' rings the editor's own chrome.
export function ShowMeStage<Api>({
  tour,
  article,
  helpLabel,
  layer = 'modal',
  pad = 14,
}: {
  tour: TourEngine<Api>;
  article: HelpArticleKey;
  helpLabel: string;
  layer?: 'overlay' | 'modal';
  pad?: number;
}) {
  return (
    <TourStage
      engine={tour}
      ariaPrefix="Show Me"
      copy={{
        outroEyebrow: 'Show Me',
        helpHref: helpArticleHref(article),
        helpLabel,
        finish: 'Done',
      }}
      layer={layer}
      pad={pad}
    />
  );
}
