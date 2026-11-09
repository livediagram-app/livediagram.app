'use client';

import { useEffect, useRef } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { AVATAR_TOUR_RELAUNCH_EVENT } from '@/lib/avatar-tour';
import { track } from '@/lib/telemetry';
import { rebaseUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import {
  askReceptionist,
  closeReceptionist,
  openReceptionist,
  setReceptionistPerson,
  useReceptionistState,
} from '@/lib/receptionist/receptionist-store';
import { withTopicHeard } from '@/lib/receptionist/receptionist-topics';

const NO_TOPICS: readonly string[] = [];

// The Receptionist's side that knows the person (docs/specs/008-canvas/receptionist.md): what they may do and have heard, the
// footer's Ask Receptionist while they walk on a tab with him, their welcome the first time he greets them, and the Settings
// rerun. His canvas layer draws him and reports the greeting; the two meet in receptionist-store.
export function ReceptionistHost() {
  const ctx = useEditorContext();
  const receptionist = useReceptionistState();
  const prefs = ctx.userPreferences;
  const welcomed = prefs?.avatarTourSeen === true;
  const heard = prefs?.receptionistTopicsSeen ?? NO_TOPICS;
  // "Welcome back, <first name>!": the first word of the display name.
  const firstName = ctx.selfParticipant?.name?.trim().split(/\s+/)[0] || null;

  useEffect(() => {
    setReceptionistPerson({ speak: ctx.can.takePart, edit: ctx.can.addContent }, heard, firstName);
  }, [ctx.can.takePart, ctx.can.addContent, heard, firstName]);
  // Leaving closes his bubble; what the canvas reported (here, greets) is the canvas's to keep.
  useEffect(() => () => closeReceptionist(), []);

  // Writes onto the freshest preferences, not this render's: the whole blob is written.
  const writePrefs = (change: Partial<UserPreferences>) => {
    const next = rebaseUserPreferences(ctx.userPreferences, { ...ctx.userPreferences, ...change });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
  };
  const writeRef = useLatest(writePrefs);

  // He reached the pad to greet you: your welcome the first time (recorded as it opens), a hello after that.
  // From 0, so a greeting that came before this host loaded (it loads on the first walk) still opens the welcome.
  const greets = useRef(0);
  const welcomedRef = useLatest(welcomed);
  useEffect(() => {
    if (receptionist.greets === greets.current) return;
    greets.current = receptionist.greets;
    if (!welcomedRef.current) {
      track('UI', 'Opened', 'ReceptionistWelcome');
      openReceptionist('welcome');
      writeRef.current({ avatarTourSeen: true });
    } else openReceptionist('back');
  }, [receptionist.greets, welcomedRef, writeRef]);

  // A topic heard is kept, so his next list leads with the ones you have not.
  const topicId = receptionist.chat.open ? receptionist.chat.topicId : null;
  const heardRef = useLatest(heard);
  useEffect(() => {
    if (!topicId || heardRef.current.includes(topicId)) return;
    writeRef.current({ receptionistTopicsSeen: withTopicHeard(heardRef.current, topicId) });
  }, [topicId, heardRef, writeRef]);

  const startPanelOpen = useStartPanelOpen();
  const canWork = ctx.hydrated && !startPanelOpen && !ctx.anyWelcomeOpen && !ctx.embedMode;
  const offered = receptionist.here && canWork;
  // The footer's button reads Ask Receptionist while he is here; unlike a tour it stays, as he answers as often as asked.
  useOfferTour(
    'receptionist',
    offered
      ? {
          name: 'Receptionist',
          label: 'Ask Receptionist',
          description: 'The Receptionist comes over and shows you how the Space works.',
          rank: TOUR_OFFER_RANK.tool,
          start: () => {
            track('UI', 'Opened', 'AskReceptionist');
            askReceptionist();
          },
        }
      : null,
  );

  // Settings rerun (Tours › "Receptionist's Welcome", turned on from off and closed): his welcome, straight away when he is
  // here; otherwise it waits for the next time he greets you.
  const offeredRef = useLatest(offered);
  useEffect(() => {
    const onRelaunch = () => {
      if (!offeredRef.current) return;
      track('UI', 'Opened', 'ReceptionistWelcome');
      askReceptionist('welcome');
      writeRef.current({ avatarTourSeen: true });
    };
    window.addEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(AVATAR_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [offeredRef, writeRef]);

  return null;
}
