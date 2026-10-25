'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { AVATAR_TOUR_RELAUNCH_EVENT } from '@/lib/avatar-tour';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  avatarTourStepTelemetryType,
  avatarTourSteps,
  tidyAvatarTour,
  type AvatarTourApi,
} from './avatar-tour-steps';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

const AVATAR_TOUR_COPY = {
  helpHref: '/help/selection-modes/avatar-mode/',
};

const NO_API: AvatarTourApi = {};

// Orchestrates the Avatar tour (docs/specs/008-canvas/avatar-tour.md). Mounted in EditorView once Avatar mode has
// been entered. While the person is in the mode, it offers the tour on the footer's Start Tour button ("Start Avatar
// Tour", ahead of the mode's own tour); a press there, or the Settings row, starts it. Mirrors DrawTourHost, with two
// differences: it is offered whatever the role (the mode is a Viewer's too, and a read-only
// canvas is its normal state), and a Viewer's tour has no Say Something step.
export function AvatarTourHost() {
  const ctx = useEditorContext();
  const apiRef = useLatest(NO_API);

  const isMobile = useIsMobileViewport();
  const canSpeak = ctx.can.takePart;
  const steps = useMemo(
    () => avatarTourSteps({ canSpeak, mobile: isMobile }),
    [canSpeak, isMobile],
  );
  const engine = useTourEngine<AvatarTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', avatarTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'AvatarTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'avatar';
  useEffect(() => {
    setActiveTour('avatar', active);
  }, [active]);

  const inAvatar = ctx.canvasTool === 'avatar';
  const startPanelOpen = useStartPanelOpen();
  const canWork = ctx.hydrated && !startPanelOpen && !ctx.anyWelcomeOpen && !ctx.embedMode;

  const endTour = (outcome: TourOutcome) => {
    tidyAvatarTour();
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      avatarTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[avatar-tour] end', { outcome });
    track('UI', 'Ended', outcome === 'completed' ? 'AvatarTourCompleted' : 'AvatarTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  const start = () => {
    if (active || otherTour) return;
    debugLog('[avatar-tour] start');
    engineRef.current.start();
  };
  // The footer's Start Tour button: offered whenever the tour could run here, taken or not (it is how it is taken
  // again). The tour never starts on its own.
  useOfferTour(
    'avatar',
    inAvatar && canWork
      ? {
          name: 'Avatar',
          rank: TOUR_OFFER_RANK.tool,
          start,
          onShown: () => track('UI', 'Opened', 'AvatarTourOffer'),
        }
      : null,
  );

  // Settings rerun (Tours › "Avatar Tour", turned on from off + closed): runs the tour in Avatar mode; elsewhere the
  // footer button is there when the person is.
  const startRef = useLatest(start);
  const canStartRef = useLatest(inAvatar && canWork);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when the tour can no longer run where it started: Avatar mode left, or another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inAvatar || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inAvatar, activeId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('avatar', false), []);

  return <TourStage engine={engine} ariaPrefix="Avatar tour" copy={AVATAR_TOUR_COPY} />;
}
