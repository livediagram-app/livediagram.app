'use client';

import { useEffect, useRef, useState } from 'react';
import { pageKindOf, type PageKind } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import {
  ILLUSTRATE_TOUR_RELAUNCH_EVENT,
  illustrateKindSeen,
  markIllustrateKindSeen,
} from '@/lib/illustrate-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { resetPageTour, tidyPageTour } from './page-tour-dom';
import { pickTourPage, type TourPage } from './illustrate-tour-page';
import { combineShowing, PAGE_PANEL, PAGE_TOUR_HELP, toolbarShowing } from './PageTour';
import { isOnScreen } from './tour-dom';
import { stepTelemetryType } from './tour-step';
import { IllustrateTourArt } from './IllustrateTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { helpArticleHref } from '@/lib/help-articles';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;
// How many times the offer looks for a tour page, one settle delay apart, before it waits for the next arming:
// about ten seconds for a tab's pages to draw.
export const OFFER_LOOKS = 12;

// The telemetry `type` of a step view, naming its track: ('slide', 'add-page') → 'IllustrateTourStepSlideAddPage'.
export function illustrateTourStepTelemetryType(kind: PageKind, stepId: string): string {
  return stepTelemetryType('IllustrateTourStep', `${kind}-${stepId}`);
}

const FINISH: Record<PageKind, string> = {
  slide: 'Start presenting',
  infographic: 'Start illustrating',
  article: 'Start writing',
  logo: 'Start designing',
};

// Orchestrates the Illustrate tour (docs/specs/007-editor/illustrate-tour.md). Mounted once in EditorView beside
// TourHost; renders nothing until a person is in Illustrate mode, with an editor they can use, on a tab with a page
// on screen of a kind whose track they have not seen, no other tour on screen and the settle delay passed, or the
// Settings row asks for a rerun. The tour page's kind picks the track; its steps load at the offer.
export function IllustrateTourHost() {
  const ctx = useEditorContext();
  const [subject, setSubject] = useState<TourPage>({ pageId: '', kind: 'infographic' });
  const apiRef = useLatest<PageTourApi>({ pageId: subject.pageId, ...PAGE_PANEL });

  const [steps, setSteps] = useState<PageTourStep[]>([]);
  const engine = useTourEngine<PageTourApi>({
    steps,
    apiRef,
    onStepView: (step) =>
      track('UI', 'View', illustrateTourStepTelemetryType(subject.kind, step.id)),
    onStart: () => track('UI', 'Started', 'IllustrateTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'illustrate';
  useEffect(() => {
    setActiveTour('illustrate', active);
  }, [active]);

  const inIllustrate = ctx.editorMode.mode === 'illustrate';
  const prefs = ctx.userPreferences;
  // Start Illustrating on screen holds the offer until a template is picked or the panel closed: the pages it points
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
  const anyUnseen = pages.some((p) => !illustrateKindSeen(prefs, pageKindOf(p)));

  // Armed on entering Illustrate (or mounting in it), on a new kind arriving, and by a relaunch; disarmed on leaving
  // it or once an offer is made. Adjusted during render when the mode or the kinds change.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  const [lastKinds, setLastKinds] = useState(kindsKey);
  if (inIllustrate !== wasIn) {
    setWasIn(inIllustrate);
    setArmed(inIllustrate);
  }
  if (kindsKey !== lastKinds) {
    setLastKinds(kindsKey);
    if (inIllustrate) setArmed(true);
  }
  // Every kind here answered already (here, or on another device): nothing is owed on this entry.
  if (armed && !anyUnseen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markIllustrateKindSeen(ctx.userPreferences, subject.kind),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[illustrate-tour] end', { outcome, kind: subject.kind });
    if (outcome === 'declined') track('UI', 'Closed', 'IllustrateTourOffer');
    else
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'IllustrateTourCompleted' : 'IllustrateTourSkipped',
      );
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);
  const prefsRef = useLatest(prefs);

  // The offer: armed, in Illustrate, usable, and no other tour on screen; then a tour page on screen, read as it is
  // offered, and its track's steps loaded. Never over the first page's own kind choice: choosing arms it again.
  useEffect(() => {
    if (!armed || active || !anyUnseen) return;
    if (!inIllustrate || !canWork || otherTour) return;
    let cancelled = false;
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    // The pages draw a moment after the editor is usable (a template's tab arriving): look again, a bounded number
    // of times, before letting the offer go until the next arming.
    const look = () => {
      if (document.querySelector('[data-first-page-choice]')) return;
      const page = pickTourPage((kind) => !illustrateKindSeen(prefsRef.current, kind));
      if (!page) {
        tries += 1;
        if (tries < OFFER_LOOKS) t = setTimeout(look, OFFER_DELAY_MS);
        else setArmed(false);
        return;
      }
      // Disarmed once the steps are in: disarming first would re-run this effect and drop the load in flight.
      void import('./page-tour-steps').then(({ illustrateTourSteps }) => {
        if (cancelled) return;
        setArmed(false);
        debugLog('[illustrate-tour] offer', { kind: page.kind });
        resetPageTour();
        setSubject(page);
        setSteps(
          illustrateTourSteps(
            page.kind,
            { combineShowing: combineShowing(), toolbarShowing: toolbarShowing() },
            { pageId: page.pageId, ...PAGE_PANEL },
            isOnScreen,
          ),
        );
        engineRef.current.start();
        track('UI', 'Opened', 'IllustrateTourOffer');
      });
    };
    t = setTimeout(look, OFFER_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [armed, active, anyUnseen, inIllustrate, canWork, otherTour, engineRef, prefsRef]);

  // Settings rerun (the Tours › "Illustrate Tour" row, turned on from off + closed): offers again in Illustrate, and
  // otherwise the next time the person enters it (the row has cleared the preferences).
  const inIllustrateRef = useLatest(inIllustrate);
  useEffect(() => {
    const onRelaunch = () => {
      if (inIllustrateRef.current) setArmed(true);
    };
    window.addEventListener(ILLUSTRATE_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(ILLUSTRATE_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inIllustrateRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Illustrate left, another tab
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
    if (!canWork || !inIllustrate || startedOnRef.current !== activeId || pageGone) {
      engineRef.current.stop();
      tidyPageTour(apiRef.current.pageId);
      PAGE_PANEL.closePanel();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inIllustrate, activeId, pageGone, engineRef, endTourRef, apiRef]);

  useEffect(() => () => setActiveTour('illustrate', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Illustrate tour"
      copy={{
        welcomeEyebrow: 'Illustrate tour',
        helpHref: helpArticleHref(PAGE_TOUR_HELP[subject.kind].article),
        finish: FINISH[subject.kind],
      }}
      welcomeArt={<IllustrateTourArt />}
    />
  );
}
