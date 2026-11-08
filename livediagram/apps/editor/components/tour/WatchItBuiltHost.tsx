'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { TOUR_RELAUNCH_EVENT } from '@/lib/diagram-tour';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';

// The player (the clock, the script and its chrome) loads on the press, so the editor's first load carries only the
// offer (docs/specs/007-editor/blueprints/watch-it-built.md "Performance").
const WatchItBuiltPlayer = dynamic(
  () => import('./WatchItBuiltPlayer').then((m) => m.WatchItBuiltPlayer),
  { ssr: false },
);

// Watch It Built (docs/specs/007-editor/watch-it-built.md): the Diagram tab's tour. Offers itself on the footer's
// Start Tour button as the stepped Diagram tour did (same rank, same taken record, same Settings rerun); a press
// counts the start, marks it taken and mounts the player, which unmounts again when the replay ends.
export function WatchItBuiltHost() {
  const ctx = useEditorContext();
  const [playing, setPlaying] = useState(false);
  // Stable, so the player's ending and its key handling are not rebuilt on every render.
  const ended = useCallback(() => setPlaying(false), []);

  // One tour at a time (editor-tour.md "Where it appears").
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'welcome';
  useEffect(() => {
    setActiveTour('welcome', playing);
  }, [playing]);
  useEffect(() => () => setActiveTour('welcome', false), []);

  const startPanelOpen = useStartPanelOpen();
  const ready =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !startPanelOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true &&
    ctx.editorMode.mode === 'diagram';
  const seen = ctx.userPreferences?.tourSeen === true;

  const start = () => {
    if (playing || otherTour) return;
    track('UI', 'Started', 'Tour');
    if (!seen) {
      const next = rebaseUserPreferences(ctx.userPreferences, {
        ...ctx.userPreferences,
        tourSeen: true,
      });
      ctx.setUserPreferences(next);
      ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    }
    setPlaying(true);
  };

  useOfferTour(
    'diagram',
    ready
      ? {
          name: 'Diagram',
          label: 'Watch It Built',
          description: 'A cursor builds a small diagram while you watch. Nothing is saved.',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'TourOffer'),
          seen,
        }
      : null,
  );

  const startRef = useLatest(start);
  const readyRef = useLatest(ready);
  useEffect(() => {
    const onRelaunch = () => {
      if (readyRef.current) startRef.current();
    };
    window.addEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [readyRef, startRef]);

  return playing ? <WatchItBuiltPlayer onEnded={ended} /> : null;
}
