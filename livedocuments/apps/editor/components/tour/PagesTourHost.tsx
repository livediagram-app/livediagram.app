'use client';

import { useEffect, useRef, useState } from 'react';
import { pagesOf, type PageKind } from '@livedocuments/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { PAGES_TOUR_RELAUNCH_EVENT, pagesKindSeen, markPagesKindSeen } from '@/lib/pages-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { resetPageTour, tidyPageTour } from './page-tour-dom';
import { pickTourPage, type TourPage } from './pages-tour-page';
import { PAGE_PANEL, PAGE_TOUR_HELP } from './PageTour';
import { isOnScreen } from '@liveworkspace/workbench/components/tour/tour-dom';
import { stepTelemetryType } from '@liveworkspace/workbench/components/tour/tour-step';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { helpArticleHref } from '@/lib/help-articles';

// The telemetry `type` of a step view, naming its track: ('slide', 'add-page') → 'PagesTourStepSlideAddPage'.
export function pagesTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('PagesTourStep', `${kind}-${stepId}`);
}

// Each track's card names its page kind, never the mode.
const EYEBROW: Record<PageKind, string> = {
  slide: 'Slides tour',
  infographic: 'Infographic tour',
  article: 'Article tour',
};

// Orchestrates the Pages tour (docs/specs/007-editor/pages-tour.md). Mounted once in EditorView beside TourHost.
// While the person is in Pages mode with an editor they can use, on a tab with a page whose kind is chosen, it offers
// the tour on the footer's Start Tour button ("Start Pages Tour"); a press there, or a Settings row, starts it on the
// page most on screen, a kind they have not taken first, its kind picking the track and its steps loading then. It
// never starts or prompts on its own.
export function PagesTourHost() {
  const ctx = useEditorContext();
  const [subject, setSubject] = useState<TourPage>({ pageId: '', kind: 'infographic' });
  const apiRef = useLatest<PageTourApi>({ pageId: subject.pageId, ...PAGE_PANEL });

  const [steps, setSteps] = useState<PageTourStep[]>([]);
  const engine = useTourEngine<PageTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', pagesTourStepTelemetryType(subject.kind, step.id)),
    onStart: () => track('UI', 'Started', 'PagesTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'pages';
  useEffect(() => {
    setActiveTour('pages', active);
  }, [active]);

  const inPages = ctx.editorMode.mode === 'pages';
  // Start Making Pages on screen holds the offer until a template is picked or the panel closed: the pages it points
  // at are hidden while it is open (docs/specs/007-editor/start-diagramming.md "The tours wait").
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  // Read through pagesOf, as the canvas reads them, so a malformed stored entry is skipped rather than throwing;
  // a tab that stores no pages has no page to tour.
  const stored = ctx.activeTab.pages;
  const pages = Array.isArray(stored) && stored.length > 0 ? pagesOf(ctx.activeTab) : [];
  // A page whose kind is chosen: the first page's own kind choice is no page to tour yet.
  const anyChosen = pages.some((p) => !!p.kind);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markPagesKindSeen(ctx.userPreferences, subject.kind),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[pages-tour] end', { outcome, kind: subject.kind });
    track('UI', 'Ended', outcome === 'completed' ? 'PagesTourCompleted' : 'PagesTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);
  const prefsRef = useLatest(ctx.userPreferences);

  // A press: the page most on screen, a kind not yet taken first, and its track's steps loaded, then the tour.
  const loadingRef = useRef(false);
  const start = () => {
    if (active || otherTour || loadingRef.current) return;
    const page =
      pickTourPage((kind) => !pagesKindSeen(prefsRef.current, kind)) ?? pickTourPage(() => true);
    if (!page) return;
    loadingRef.current = true;
    void import('./page-tour-steps')
      .then(({ shownPageTourSteps }) => {
        debugLog('[pages-tour] start', { kind: page.kind });
        resetPageTour();
        setSubject(page);
        setSteps(shownPageTourSteps(page.kind, { pageId: page.pageId, ...PAGE_PANEL }, isOnScreen));
        engineRef.current.start();
      })
      .finally(() => {
        loadingRef.current = false;
      });
  };
  const canStart = inPages && canWork && anyChosen;
  // The footer's Start Tour button: offered whenever the tour could run here, taken or not (it is how it is taken
  // again).
  useOfferTour(
    'pages',
    canStart
      ? {
          name: 'Pages',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'PagesTourOffer'),
        }
      : null,
  );

  // Settings rerun (a Tours › kind's row, turned on from off + closed): runs the tour in Pages; elsewhere the footer
  // button is there when the person is.
  const startRef = useLatest(start);
  const canStartRef = useLatest(canStart);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(PAGES_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PAGES_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Pages left, another tab
  // opened, or the tour page deleted or locked. Whatever a step opened is closed.
  const activeId = ctx.activeTab.id;
  const tourPage = pages.find((p) => p.id === subject.pageId);
  const pageGone = !tourPage || tourPage.locked === true;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inPages || startedOnRef.current !== activeId || pageGone) {
      engineRef.current.stop();
      tidyPageTour(apiRef.current.pageId);
      PAGE_PANEL.closePanel();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inPages, activeId, pageGone, engineRef, endTourRef, apiRef]);

  useEffect(() => () => setActiveTour('pages', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix={EYEBROW[subject.kind]}
      copy={{
        helpHref: helpArticleHref(PAGE_TOUR_HELP[subject.kind].article),
      }}
    />
  );
}
