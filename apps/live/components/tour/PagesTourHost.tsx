'use client';

import { useEffect, useRef, useState } from 'react';
import { pageKindOf, type PageKind } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { PAGES_TOUR_RELAUNCH_EVENT, pagesKindSeen, markPagesKindSeen } from '@/lib/pages-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { useAnyModalOpen } from '@/lib/modal-guard';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { resetPageTour, tidyPageTour } from './page-tour-dom';
import { pickTourPage, type TourPage } from './pages-tour-page';
import { combineShowing, PAGE_PANEL, PAGE_TOUR_HELP } from './PageTour';
import { isOnScreen } from './tour-dom';
import { stepTelemetryType } from './tour-step';
import { PagesTourArt } from './art/pages-tour-art';
import { CoachDockStage } from './coach-dock/CoachDockStage';
import { TOUR_FINISH } from './tour-card-copy';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { helpArticleHref } from '@/lib/help-articles';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;
// How many times the offer looks for a tour page, one settle delay apart, before it waits for the next arming:
// about ten seconds for a tab's pages to draw.
const OFFER_LOOKS = 12;

// The telemetry `type` of a step view, naming its track: ('slide', 'add-page') → 'PagesTourStepSlideAddPage'.
export function pagesTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('PagesTourStep', `${kind}-${stepId}`);
}

// Each offer names its page kind's track, never the mode.
const EYEBROW: Record<PageKind, string> = {
  slide: 'Slides tour',
  infographic: 'Infographic tour',
  article: 'Article tour',
  logo: 'Logo tour',
};

// The tour chip a folded offer leaves in the tab bar (docs/specs/007-editor/coach-dock.md "The offer").
const CHIP: Record<PageKind, { label: string; about: string }> = {
  slide: { label: 'Slides Tour', about: 'A short tour of making slides, on your own slide.' },
  infographic: {
    label: 'Infographic Tour',
    about: 'A short tour of laying out an infographic, on your own page.',
  },
  article: {
    label: 'Article Tour',
    about: 'A short tour of writing an article, on your own page.',
  },
  logo: { label: 'Logo Tour', about: 'A short tour of making a logo, on your own artboard.' },
};

// Orchestrates the Pages tour (docs/specs/007-editor/pages-tour.md). Mounted once in EditorView beside
// TourHost; renders nothing until a person is in Pages mode, with an editor they can use, on a tab with a page
// on screen of a kind whose track they have not seen, no other tour on screen and the settle delay passed, or the
// Settings row asks for a rerun. The tour page's kind picks the track; its steps load at the offer.
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

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'pages';
  // Dialogs come first (docs/specs/007-editor/editor-tour.md): the offer waits for the last one to close.
  const modalOpen = useAnyModalOpen();
  useEffect(() => {
    setActiveTour('pages', active);
  }, [active]);

  const inPages = ctx.editorMode.mode === 'pages';
  const prefs = ctx.userPreferences;
  // Start Making Pages on screen holds the offer until a template is picked or the panel closed: the pages it points
  // at are hidden while it is open (docs/specs/007-editor/start-diagramming.md "The tours wait").
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  // The kinds on the tab, an unchosen first page apart: a kind arriving (a page added, the first page's kind chosen)
  // arms the offer again.
  const pages = ctx.activeTab.pages ?? [];
  const kindsKey = [...new Set(pages.map((p) => (p.kind ? pageKindOf(p) : 'unchosen')))]
    .sort()
    .join(',');
  const anyUnseen = pages.some((p) => !pagesKindSeen(prefs, pageKindOf(p)));

  // Armed on entering Pages (or mounting in it), on a new kind arriving, and by a relaunch; disarmed on leaving
  // it or once an offer is made. Adjusted during render when the mode or the kinds change.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  const [lastKinds, setLastKinds] = useState(kindsKey);
  if (inPages !== wasIn) {
    setWasIn(inPages);
    setArmed(inPages);
  }
  if (kindsKey !== lastKinds) {
    setLastKinds(kindsKey);
    if (inPages) setArmed(true);
  }
  // Every kind here answered already (here, or on another device): nothing is owed on this entry.
  if (armed && !anyUnseen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markPagesKindSeen(ctx.userPreferences, subject.kind),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[pages-tour] end', { outcome, kind: subject.kind });
    if (outcome === 'declined') track('UI', 'Closed', 'PagesTourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'PagesTourCompleted' : 'PagesTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);
  const prefsRef = useLatest(prefs);

  // The offer: armed, in Pages, usable, and no other tour on screen; then a tour page on screen, read as it is
  // offered, and its track's steps loaded. Never over the first page's own kind choice: choosing arms it again.
  useEffect(() => {
    if (!armed || active || !anyUnseen) return;
    if (!inPages || !canWork || otherTour || modalOpen) return;
    let cancelled = false;
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    // The pages draw a moment after the editor is usable (a template's tab arriving): look again, a bounded number
    // of times, before letting the offer go until the next arming.
    const look = () => {
      if (document.querySelector('[data-first-page-choice]')) return;
      const page = pickTourPage((kind) => !pagesKindSeen(prefsRef.current, kind));
      if (!page) {
        tries += 1;
        if (tries < OFFER_LOOKS) t = setTimeout(look, OFFER_DELAY_MS);
        else setArmed(false);
        return;
      }
      // Disarmed once the steps are in: disarming first would re-run this effect and drop the load in flight.
      void import('./page-tour-steps').then(({ pagesTourSteps }) => {
        if (cancelled) return;
        setArmed(false);
        debugLog('[pages-tour] offer', { kind: page.kind });
        resetPageTour();
        setSubject(page);
        setSteps(
          pagesTourSteps(
            page.kind,
            { combineShowing: combineShowing() },
            { pageId: page.pageId, ...PAGE_PANEL },
            isOnScreen,
          ),
        );
        engineRef.current.start();
        track('UI', 'Opened', 'PagesTourOffer');
      });
    };
    t = setTimeout(look, OFFER_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [armed, active, anyUnseen, inPages, canWork, otherTour, modalOpen, engineRef, prefsRef]);

  // Settings rerun (the Tours › "Pages Tour" row, turned on from off + closed): offers again in Pages, and
  // otherwise the next time the person enters it (the row has cleared the preferences).
  const inPagesRef = useLatest(inPages);
  useEffect(() => {
    const onRelaunch = () => {
      if (inPagesRef.current) setArmed(true);
    };
    window.addEventListener(PAGES_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PAGES_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inPagesRef]);

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

  const help = PAGE_TOUR_HELP[subject.kind];
  return (
    <CoachDockStage
      engine={engine}
      api={{ pageId: subject.pageId, ...PAGE_PANEL }}
      eyebrow={EYEBROW[subject.kind]}
      art={<PagesTourArt kind={subject.kind} />}
      help={{ href: helpArticleHref(help.article), label: help.label }}
      finish={TOUR_FINISH}
      chip={CHIP[subject.kind]}
      onFolded={() => track('UI', 'Closed', 'PagesTourOfferFolded')}
      onChipStart={() => track('UI', 'Opened', 'PagesTourChip')}
    />
  );
}
