// Follow-me viewport (spec/131): pin your pan / zoom / tab to a peer's until
// you take the canvas back.
//
// "Look at this" is the most common sentence spoken over a shared board, and
// every tool that answers it today — the laser, the spotlight, a walked-to
// avatar — points AT something from where the speaker already is, which is no
// use to somebody scrolled elsewhere. Following is the missing half: instead
// of moving the pointer to the audience, move the audience to the pointer.

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/telemetry';

export type RemoteViewport = { tabId: string; pan: { x: number; y: number }; zoom: number };

type Pan = { x: number; y: number };

const samePan = (a: Pan, b: Pan) => a.x === b.x && a.y === b.y;

export function useFollowMe({
  remoteViewports,
  livePresenceIds,
  activeId,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  setZoom,
  onFollowTab,
  onNotice,
}: {
  remoteViewports: Map<string, RemoteViewport>;
  // Who is still in the room, so a follow ends by itself when they leave.
  livePresenceIds: string[];
  activeId: string;
  // The LOCAL viewport, watched so any move of our own breaks the follow.
  viewportOffset: Pan;
  viewportZoom: number;
  setViewportOffset: (pan: Pan) => void;
  setZoom: (zoom: number) => void;
  // Switch to the tab the presenter is on: "look at this" has to work when
  // the this is on tab 3.
  onFollowTab: (tabId: string) => void;
  // One-line explanation when a follow ends by itself.
  onNotice: (message: string) => void;
}) {
  const [followingId, setFollowingId] = useState<string | null>(null);
  // The last viewport WE wrote while following. Anything else appearing in
  // `viewportOffset` / `viewportZoom` is the user moving the canvas.
  const appliedRef = useRef<{ pan: Pan; zoom: number } | null>(null);

  const stopFollowing = useCallback(() => {
    appliedRef.current = null;
    setFollowingId(null);
  }, []);

  const startFollowing = useCallback((participantId: string) => {
    // Seeded so the first frame we apply isn't mistaken for a user gesture.
    appliedRef.current = null;
    setFollowingId(participantId);
    // spec/22: the other "look at this" tools (laser, spotlight, avatar mode)
    // all report as Canvas·Used, so following ranks beside them on the
    // dashboard's Selection-modes list instead of being the one pointing tool
    // nobody can see the usage of. Entering the mode only, never per frame —
    // the applied viewports are a continuous gesture.
    track('Canvas', 'Used', 'FollowMe');
  }, []);

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
    setViewportOffset(seen.pan);
    setZoom(seen.zoom);
  }, [followingId, remoteViewports, activeId, onFollowTab, setViewportOffset, setZoom]);

  // Any canvas gesture of your own breaks it, instantly and silently — pan,
  // zoom, pinch, arrow keys, fit-to-screen, the minimap. Grabbing the canvas
  // IS the statement that you want your own view back, and a follow that
  // survived it would be a fight the user cannot win. No confirmation and no
  // toast: the pill going away says so.
  //
  // Watching the viewport itself rather than instrumenting each gesture is
  // what makes that list exhaustive: every route ends in these two values, so
  // none of them can be forgotten here or added later without being covered.
  useEffect(() => {
    if (!followingId) return;
    const applied = appliedRef.current;
    if (!applied) return;
    if (samePan(applied.pan, viewportOffset) && applied.zoom === viewportZoom) return;
    appliedRef.current = null;
    setFollowingId(null);
  }, [followingId, viewportOffset, viewportZoom]);

  // The follow ends by itself when the person leaves the room, with a line so
  // the sudden freedom is explained rather than just happening.
  useEffect(() => {
    if (!followingId) return;
    if (livePresenceIds.includes(followingId)) return;
    appliedRef.current = null;
    setFollowingId(null);
    onNotice('The person you were following left. Your view is your own again.');
  }, [followingId, livePresenceIds, onNotice]);

  return { followingId, startFollowing, stopFollowing };
}
