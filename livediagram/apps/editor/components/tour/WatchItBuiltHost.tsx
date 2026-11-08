'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { CURRICULUM, topicCard } from '@/lib/replay/curriculum';
import type { ReplayMode } from '@/lib/replay/topic';
import { WATCH_RELAUNCH_EVENT } from '@/lib/watch-relaunch';
import { markTopicTaken, topicsOwed, topicTaken } from '@/lib/watch-topics';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import type { ReplayEnd } from './WatchItBuiltPlayer';

// The start panel and the player (its clock, the replays and their chrome) load on the press, so the editor's first
// load carries only the offer and the topic list (docs/specs/007-editor/blueprints/watch-it-built.md "Performance").
const WatchStartPanel = dynamic(() => import('./WatchStartPanel').then((m) => m.WatchStartPanel), {
  ssr: false,
});
const WatchItBuiltPlayer = dynamic(
  () => import('./WatchItBuiltPlayer').then((m) => m.WatchItBuiltPlayer),
  { ssr: false },
);

const MODES: Record<ReplayMode, string> = {
  diagram: 'Diagram',
  draw: 'Draw',
  workshop: 'Workshop',
};
const isReplayMode = (mode: string): mode is ReplayMode => mode in MODES;

// Nothing on screen, the start panel, or a topic playing.
type Run = null | { mode: ReplayMode; topic: string | null };

// Watch It Built (docs/specs/007-editor/watch-it-built.md): the tour of Diagram, Draw and Workshop. Offers itself on
// the footer's Start Tour button while the open mode has a topic not yet taken; a press opens the start panel, a pick
// marks that topic taken and plays it, and More Topics at its end comes back to the panel.
export function WatchItBuiltHost() {
  const ctx = useEditorContext();
  const [run, setRun] = useState<Run>(null);

  // One tour at a time (editor-tour.md "Where it appears").
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'welcome';
  const on = run !== null;
  useEffect(() => {
    setActiveTour('welcome', on);
  }, [on]);
  useEffect(() => () => setActiveTour('welcome', false), []);

  const mode = isReplayMode(ctx.editorMode.mode) ? ctx.editorMode.mode : null;
  const startPanelOpen = useStartPanelOpen();
  const ready =
    mode !== null &&
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !startPanelOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;
  const owed = mode ? topicsOwed(ctx.userPreferences, mode).length : 0;

  // The panel closes if the mode it was opened for goes, or the editor can no longer take it: adjusted while
  // rendering (React's pattern for state that follows other values), so it never paints a frame stale.
  if (run && run.topic === null && (!ready || run.mode !== mode)) setRun(null);

  const open = () => {
    if (!mode || run || otherTour) return;
    track('UI', 'Opened', 'WatchStart');
    setRun({ mode, topic: null });
  };

  const pick = (id: string) => {
    const card = topicCard(id);
    if (!run || !card) return;
    track('UI', 'Started', 'Tour');
    track('UI', 'View', `WatchTopic${card.telemetry}`);
    // Taken as it starts, onto the freshest preferences (the whole blob is written), so a reload mid-replay keeps it.
    if (!topicTaken(ctx.userPreferences, id)) {
      const prefs = ctx.userPreferences ?? {};
      const next = rebaseUserPreferences(ctx.userPreferences, markTopicTaken(prefs, id));
      ctx.setUserPreferences(next);
      ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    }
    setRun({ mode: run.mode, topic: id });
  };

  const close = useCallback(() => setRun(null), []);
  const ended = useCallback(
    (how: ReplayEnd) => setRun((r) => (how === 'more' && r ? { mode: r.mode, topic: null } : null)),
    [],
  );

  useOfferTour(
    mode ?? 'diagram',
    ready && mode
      ? {
          name: MODES[mode],
          label: 'Watch It Built',
          description: 'Pick something to learn and watch a cursor show you. Nothing is saved.',
          rank: TOUR_OFFER_RANK.mode,
          start: open,
          onShown: () => track('UI', 'Opened', 'TourOffer'),
          seen: owed === 0,
        }
      : null,
  );

  // Settings rerun: the start panel for the mode it named, when the open tab is in it.
  const openRef = useLatest(open);
  const readyRef = useLatest(ready);
  const modeRef = useLatest(mode);
  useEffect(() => {
    const onRelaunch = (e: Event) => {
      const want = (e as CustomEvent<ReplayMode>).detail;
      if (readyRef.current && modeRef.current === want) openRef.current();
    };
    window.addEventListener(WATCH_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(WATCH_RELAUNCH_EVENT, onRelaunch);
  }, [readyRef, modeRef, openRef]);

  if (!run) return null;
  const list = CURRICULUM[run.mode];
  if (run.topic === null) {
    return (
      <WatchStartPanel
        topics={list.map((t) => ({
          id: t.id,
          title: t.title,
          line: t.line,
          meta: `${t.seconds} s`,
          taken: topicTaken(ctx.userPreferences, t.id),
        }))}
        canvasRef={ctx.canvasMainRef}
        onPick={pick}
        onClose={close}
      />
    );
  }
  const card = topicCard(run.topic)!;
  return <WatchItBuiltPlayer key={card.id} card={card} hasMore={list.length > 1} onEnded={ended} />;
}
