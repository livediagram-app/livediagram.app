'use client';

// Opening a walkthrough to play (liveworkspace/docs/specs/006-media/walkthroughs.md "Playing"): its events and its
// media, fetched together; the viewer's tab, view and slide kept to put back on close; the recorded hidden elements
// hidden for as long as it is open. The playing itself is the Player's.

import type { WalkthroughEvents, WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalkthroughApi } from './api';
import { applyHidden } from './bridge';
import type { WalkthroughHost } from './host';
import { buildTimeline, editedSince, type CanvasView, type Timeline } from './timeline';

export type Loaded = {
  walkthrough: WalkthroughSummary;
  events: WalkthroughEvents;
  timeline: Timeline;
  url: string;
  edited: boolean;
};

export type PlayerPhase =
  | { kind: 'off' }
  | { kind: 'loading'; id: string }
  | { kind: 'failed'; message: string }
  | ({ kind: 'ready' } & Loaded);

export type PlayerState = ReturnType<typeof usePlayer>;

type Restore = { tab: string; view: CanvasView; slide: string | null };

export function usePlayer(host: WalkthroughHost, api: WalkthroughApi | null) {
  const [phase, setPhase] = useState<PlayerPhase>({ kind: 'off' });
  const restoreRef = useRef<Restore | null>(null);
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  });
  const ticket = useRef(0);

  const open = useCallback(
    async (id: string) => {
      if (!api) return;
      const mine = ++ticket.current;
      setPhase({ kind: 'loading', id });
      const [read, media] = await Promise.all([api.read(id), api.media(id)]);
      if (mine !== ticket.current) return;
      if (!read || !media) {
        setPhase({ kind: 'failed', message: "This walkthrough couldn't be opened. Try again." });
        return;
      }
      const h = hostRef.current;
      restoreRef.current = {
        tab: h.tab,
        view: h.viewport.get(),
        slide: h.slides?.current ?? null,
      };
      setPhase({
        kind: 'ready',
        walkthrough: read.walkthrough,
        events: read.events,
        timeline: buildTimeline(read.events, h.tabName),
        url: URL.createObjectURL(media),
        edited: editedSince(read.events.fingerprints, h.fingerprint).length > 0,
      });
    },
    [api],
  );

  const close = useCallback(() => {
    ticket.current++;
    setPhase((p) => {
      if (p.kind === 'ready') URL.revokeObjectURL(p.url);
      return { kind: 'off' };
    });
    const restore = restoreRef.current;
    restoreRef.current = null;
    if (!restore) return;
    const h = hostRef.current;
    if ((h.slides?.current ?? null) !== restore.slide) h.slides?.show(restore.slide);
    if (h.tab !== restore.tab) h.showTab(restore.tab);
    // After the tab has drawn: a tab change sets its own view first.
    requestAnimationFrame(() => hostRef.current.viewport.setView(restore.view));
  }, []);

  // The recorded hidden elements, hidden while it is open.
  const hidden = phase.kind === 'ready' ? phase.events.hidden : null;
  const marks = host.hideable?.marks;
  useEffect(() => {
    if (!hidden) return;
    return applyHidden(document, hidden, 'viewer', marks);
  }, [hidden, marks]);

  // Leaving the item with a walkthrough open lets go of its media.
  const url = phase.kind === 'ready' ? phase.url : null;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return { phase, open, close };
}
