'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { AVATAR_TOUR_RELAUNCH_EVENT } from '@/lib/avatar-tour';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { useAnyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import {
  avatarTourStepTelemetryType,
  avatarTourSteps,
  tidyAvatarTour,
  type AvatarTourApi,
} from './avatar-tour-steps';
import { AvatarTourArt } from './AvatarTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The settle delay before the offer, as the other tours'.
export const OFFER_DELAY_MS = 800;

const AVATAR_TOUR_COPY = {
  welcomeEyebrow: 'Avatar tour',
  helpHref: '/help/selection-modes/avatar-mode/',
};

const NO_API: AvatarTourApi = {};

// Orchestrates the Avatar tour (docs/specs/008-canvas/avatar-tour.md). Mounted in EditorView once Avatar mode has
// been entered; renders nothing until a person who has not seen it is in the mode with an editor they can use, no
// other tour is on screen and the settle delay has passed, or the Settings row asks for a rerun. Mirrors
// DrawTourHost, with two differences: it is offered whatever the role (the mode is a Viewer's too, and a read-only
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

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'avatar';
  // Dialogs come first (docs/specs/007-editor/editor-tour.md): the offer waits for the last one to close.
  const modalOpen = useAnyModalOpen();
  useEffect(() => {
    setActiveTour('avatar', active);
  }, [active]);

  const inAvatar = ctx.canvasTool === 'avatar';
  const seen = ctx.userPreferences?.avatarTourSeen === true;
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !ctx.anyWelcomeOpen &&
    !ctx.embedMode;

  // Armed on entering Avatar mode (or mounting in it), and by a relaunch; disarmed on leaving it or once offered.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inAvatar !== wasIn) {
    setWasIn(inAvatar);
    setArmed(inAvatar);
  }
  if (armed && seen) setArmed(false);

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
    if (outcome === 'declined') track('UI', 'Closed', 'AvatarTourOffer');
    else
      track('UI', 'Ended', outcome === 'completed' ? 'AvatarTourCompleted' : 'AvatarTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inAvatar || !canWork || otherTour || modalOpen) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[avatar-tour] offer');
      engineRef.current.start();
      track('UI', 'Opened', 'AvatarTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inAvatar, canWork, otherTour, modalOpen, engineRef]);

  // Settings rerun (Tours › "Avatar Tour", turned on from off + closed): offers again in Avatar mode, and otherwise
  // the next time the person enters it (the row has cleared the preference).
  const inAvatarRef = useLatest(inAvatar);
  useEffect(() => {
    const onRelaunch = () => {
      if (inAvatarRef.current) setArmed(true);
    };
    window.addEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inAvatarRef]);

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

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Avatar tour"
      copy={AVATAR_TOUR_COPY}
      welcomeArt={<AvatarTourArt />}
    />
  );
}
