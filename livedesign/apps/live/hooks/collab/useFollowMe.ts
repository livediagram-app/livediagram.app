// Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md): pin your pan / zoom / tab to a peer's until
// you take the canvas back.
//
// "Look at this" is the most common sentence spoken over a shared canvas, and
// every tool that answers it today — the laser, the spotlight, a walked-to
// avatar — points AT something from where the speaker already is, which is no
// use to somebody scrolled elsewhere. Following is the missing half: instead
// of moving the pointer to the audience, move the audience to the pointer.

import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// A peer's last published `viewport` op. `size` is their canvas, missing from a client from before it was sent.
export type RemoteViewport = {
  tabId: string;
  pan: { x: number; y: number };
  zoom: number;
  size?: { width: number; height: number };
};

type Pan = { x: number; y: number };

const samePan = (a: Pan, b: Pan) => a.x === b.x && a.y === b.y;

export function useFollowMe({
  remoteViewports,
  livePresenceIds,
  activeId,
  viewport,
  onFollowTab,
  onNotice,
  followerIds = [],
  nameOf = () => 'Someone',
  sendFollow = () => {},
}: {
  remoteViewports: Map<string, RemoteViewport>;
  // Who is still in the room, so a follow ends by itself when they leave.
  livePresenceIds: string[];
  activeId: string;
  // The LOCAL view: written when following, watched so any move of our own breaks the follow
  // (docs/specs/008-canvas/blueprints/viewport-store.md).
  viewport: ViewportStore;
  // Switch to the tab the presenter is on: "look at this" has to work when
  // the this is on tab 3.
  onFollowTab: (tabId: string) => void;
  // One-line explanation when a follow ends by itself, or is refused.
  onNotice: (message: string) => void;
  // Who follows us, by presence id, as the room tells us (docs/specs/012-collaboration/follow-me-viewport.md "Who
  // follows whom"): one of them can't be followed back, or two mirrors face each other.
  followerIds?: readonly string[];
  // A participant's name, for the refusal's line.
  nameOf?: (participantId: string) => string;
  // Tell the room who we follow now (null: nobody), so the person followed can be told.
  sendFollow?: (target: string | null) => void;
}) {
  const [followingId, setFollowingId] = useState<string | null>(null);
  const onNoticeRef = useLatest(onNotice);
  // The last view WE wrote while following. Any other view appearing in the store is the user moving
  // the canvas.
  const appliedRef = useRef<{ pan: Pan; zoom: number } | null>(null);

  const stopFollowing = useCallback(() => {
    appliedRef.current = null;
    setFollowingId(null);
  }, []);

  const followerIdsRef = useLatest(followerIds);
  const nameOfRef = useLatest(nameOf);
  const startFollowing = useCallback(
    (participantId: string) => {
      // Following someone who follows you is refused, with the reason: two mirrors pointed at each other.
      if (followerIdsRef.current.includes(participantId)) {
        onNoticeRef.current(
          `${nameOfRef.current(participantId)} is following you, so you can't follow them back.`,
        );
        return;
      }
      // Seeded so the first frame we apply isn't mistaken for a user gesture.
      appliedRef.current = null;
      setFollowingId(participantId);
      // docs/specs/017-telemetry/telemetry.md: the other "look at this" tools (laser, spotlight)
      // all report as Canvas·Used, so following ranks beside them on the
      // dashboard's Selection-modes list instead of being the one pointing tool
      // nobody can see the usage of. Entering the mode only, never per frame —
      // the applied viewports are a continuous gesture.
      track('Canvas', 'Used', 'FollowMe');
    },
    [followerIdsRef, nameOfRef, onNoticeRef],
  );

  // The room hears every change of who we follow, and nothing before the first.
  const sendFollowEvent = useEffectEvent((target: string | null) => sendFollow(target));
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (announced.current === followingId) return;
    announced.current = followingId;
    sendFollowEvent(followingId);
  }, [followingId]);

  // The follow ends by itself when the person leaves the room, during
  // render so no frame follows somebody who has gone, with a line so the
  // sudden freedom is explained.
  const [departures, setDepartures] = useState(0);
  if (followingId !== null && !livePresenceIds.includes(followingId)) {
    setFollowingId(null);
    setDepartures((n) => n + 1);
  }
  const announceDeparture = useEffectEvent(() =>
    onNotice('The person you were following left. Your view is your own again.'),
  );
  useEffect(() => {
    if (departures > 0) announceDeparture();
  }, [departures]);

  // Two people who press Follow on each other at once both pass the refusal above before the room's `followers`
  // frame arrives, and would mirror each other for good. When the person we follow turns out to follow us, the
  // follow ends, during render like a departure, with the refusal's line.
  const [crossed, setCrossed] = useState<{ id: string; n: number } | null>(null);
  if (followingId !== null && followerIds.includes(followingId)) {
    setFollowingId(null);
    setCrossed((c) => ({ id: followingId, n: (c?.n ?? 0) + 1 }));
  }
  const announceCrossed = useEffectEvent((id: string) =>
    onNotice(`${nameOf(id)} is following you, so you can't follow them back.`),
  );
  useEffect(() => {
    if (crossed) announceCrossed(crossed.id);
  }, [crossed]);

  // Any canvas gesture of your own breaks it, instantly and silently — pan,
  // zoom, pinch, arrow keys, fit-to-screen, the minimap. Grabbing the canvas
  // IS the statement that you want your own view back, and a follow that
  // survived it would be a fight the user cannot win. No confirmation and no
  // toast: the pill going away says so.
  //
  // Watching the viewport itself rather than instrumenting each gesture is
  // what makes that list exhaustive: every route ends in these two values, so
  // none of them can be forgotten here or added later without being covered.
  //
  // Watched only while following, through the store: our own apply writes the whole view at once
  // (setView) after recording it, so the listener never sees a half-applied view.
  useEffect(() => {
    if (!followingId) return;
    return viewport.subscribe(() => {
      const applied = appliedRef.current;
      if (!applied) return;
      const { offset, zoom } = viewport.get();
      if (samePan(applied.pan, offset) && applied.zoom === zoom) return;
      appliedRef.current = null;
      setFollowingId(null);
    });
  }, [followingId, viewport]);

  // Apply the followed peer's viewport.
  //
  // Zoom is mirrored EXACTLY rather than re-fitted. A follower on a smaller
  // screen therefore sees the same zoom level and less of the canvas, centred
  // on the same point. Re-fitting to show the same CONTENT would silently
  // change the zoom the presenter is talking about ("see how small this is")
  // and put every follower on a different view of a feature whose entire
  // promise is the same view.
  useEffect(() => {
    if (!followingId) return;
    const seen = remoteViewports.get(followingId);
    if (!seen) return;
    if (seen.tabId !== activeId) onFollowTab(seen.tabId);
    appliedRef.current = { pan: seen.pan, zoom: seen.zoom };
    viewport.setView({ zoom: seen.zoom, offset: seen.pan });
  }, [followingId, remoteViewports, activeId, onFollowTab, viewport]);

  return { followingId, startFollowing, stopFollowing, followerCount: followerIds.length };
}
