'use client';

// Show Me on a page (docs/specs/007-editor/show-me.md; pages-tour.md "Where it appears"; logo-pages.md "Show
// Me"): the page kind's track of the Pages tour, run on demand from the page's panel and drawn over the page.
// Never offered: only the button in the page panel runs it. Each kind sends its own literal telemetry, so the
// dashboard's emitter scan reads every event.
import { useEffect, useState } from 'react';
import type { PageKind } from '@livepages/document';
import { useLatest } from '@/hooks/ui/useLatest';
import type { HelpArticleKey } from '@/lib/help-articles';
import { requestPagePanel } from '@/lib/page-panel-request';
import { track } from '@/lib/telemetry';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { isOnScreen } from './tour-dom';
import { useTourEngine, type TourEngine } from './useTourEngine';

/** The page's panel, opened on a tab or closed, through the request CanvasPages follows. */
export const PAGE_PANEL: Pick<PageTourApi, 'openPanel' | 'closePanel'> = {
  openPanel: (pageId, tab) => requestPagePanel(pageId, tab),
  closePanel: () => requestPagePanel(null),
};

type Frozen = { pageId: string; kind: PageKind };

function trackStarted(kind: PageKind) {
  if (kind === 'slide') track('UI', 'Started', 'SlideTour');
  else if (kind === 'article') track('UI', 'Started', 'ArticleTour');
  else if (kind === 'logo') track('UI', 'Started', 'LogoTour');
  else track('UI', 'Started', 'InfographicTour');
}

function trackEnded(kind: PageKind, completed: boolean) {
  if (kind === 'slide') track('UI', 'Ended', completed ? 'SlideTourCompleted' : 'SlideTourSkipped');
  else if (kind === 'article')
    track('UI', 'Ended', completed ? 'ArticleTourCompleted' : 'ArticleTourSkipped');
  else if (kind === 'logo')
    track('UI', 'Ended', completed ? 'LogoTourCompleted' : 'LogoTourSkipped');
  else track('UI', 'Ended', completed ? 'InfographicTourCompleted' : 'InfographicTourSkipped');
}

// The tour, and `freeze`, which fixes its page, kind and steps when Show Me is pressed. The steps load at the press,
// so their copy stays out of the editor's first load. `editable` says whether a page is still there to edit: the tour
// ends with its page (deleted, locked, or no longer editable), as it does with any surface closed under it.
export function usePageTour(editable: (pageId: string) => boolean): {
  tour: TourEngine<PageTourApi>;
  // The kind of the page it last ran on, for its closing card's help link.
  kind: PageKind;
  freeze: (pageId: string, kind: PageKind) => Promise<void>;
} {
  const [frozen, setFrozen] = useState<Frozen>({ pageId: '', kind: 'infographic' });
  const [steps, setSteps] = useState<PageTourStep[]>([]);
  const apiRef = useLatest<PageTourApi>({ pageId: frozen.pageId, ...PAGE_PANEL });
  const tour = useTourEngine<PageTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) => {
      trackEnded(frozen.kind, outcome === 'completed');
    },
  });
  const gone = tour.active && !editable(frozen.pageId);
  const { stop } = tour;
  const pageId = frozen.pageId;
  useEffect(() => {
    if (!gone) return;
    stop();
    // The steps' module is in by now: the tour ran on them.
    void import('./page-tour-steps').then((m) => m.tidyPageTour(pageId));
    PAGE_PANEL.closePanel();
  }, [gone, stop, pageId]);
  const freeze = async (pageId: string, kind: PageKind) => {
    const { shownPageTourSteps, resetPageTour } = await import('./page-tour-steps');
    const api = { pageId, ...PAGE_PANEL };
    const next = shownPageTourSteps(kind, api, isOnScreen);
    resetPageTour();
    // The panel Show Me was pressed in makes way for the page: a step that is about the panel opens it again.
    PAGE_PANEL.closePanel();
    setFrozen({ pageId, kind });
    setSteps(next);
  };
  return { tour, kind: frozen.kind, freeze };
}

export function PageShowMeButton({
  tour,
  kind,
  onStart,
}: {
  tour: TourEngine<PageTourApi>;
  kind: PageKind;
  onStart: () => Promise<void>;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        trackStarted(kind);
        return onStart();
      }}
    />
  );
}

// Each kind's help article, linked beside Show Me and from the tour's closing card.
export const PAGE_TOUR_HELP: Record<PageKind, { article: HelpArticleKey }> = {
  slide: { article: 'slidePages' },
  infographic: { article: 'infographicLayouts' },
  article: { article: 'articlePages' },
  logo: { article: 'logoPages' },
  wireframe: { article: 'wireframePages' },
};

export function PageTourStage({ tour, kind }: { tour: TourEngine<PageTourApi>; kind: PageKind }) {
  const help = PAGE_TOUR_HELP[kind];
  return <ShowMeStage tour={tour} article={help.article} layer="overlay" pad={8} />;
}
