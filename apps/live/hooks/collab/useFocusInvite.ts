'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Bring Focus (spec/144): the invitation somebody else's press puts on your
// screen, and what taking it does.
//
// The whole of this element's restraint lives here. A press moves NOBODY: it
// leaves a dialog that says who wants you where, and your view is untouched
// until you take it. That is the one place this parts company with Follow Me
// (spec/131), which is unilateral by design — the difference is push versus
// pull. A follower chose to be moved and can stop whenever; a yank arrives
// unasked, in the middle of whatever you were doing, and a board where anybody
// can teleport everybody is a board where somebody's half-typed note is lost.

/** A live invitation: where it points, and who sent it. */
export type FocusInvite = {
  /** The presence id of whoever pressed, so the dialog can name them from the
   *  participant list (the op carries no name: a renamed participant's
   *  invitation should read correctly). */
  from: string;
  tabId: string;
  at: { x: number; y: number };
  zoom: number;
};

// Long enough to look up from what you were doing, short enough that it is
// never answering a sentence from two topics ago.
const EXPIRY_MS = 60_000;

export function useFocusInvite(deps: {
  /** Switch to the tab the invitation points at, when it is not this one. */
  onFollowTab: (tabId: string) => void;
  /** Centre a canvas point at a given zoom. */
  onCentreOn: (at: { x: number; y: number }, zoom: number) => void;
}): {
  invite: FocusInvite | null;
  /** An invitation arrived. Replaces any earlier one: the room has one current
   *  "look at this", and an older one is stale by definition. */
  receiveFocusHere: (
    from: string,
    tabId: string,
    at: { x: number; y: number },
    zoom: number,
  ) => void;
  /** Take it: switch tab if needed, then centre. One-off, so it clears itself
   *  and leaves nothing pinned. */
  acceptFocus: () => void;
  dismissFocus: () => void;
} {
  const [invite, setInvite] = useState<FocusInvite | null>(null);
  // Live ref so the timer and the accept path read the current handlers
  // without re-arming on every render.
  const ref = useRef(deps);
  ref.current = deps;

  // Expiry is per invitation, so a second one restarts the clock rather than
  // inheriting the remains of the first one's.
  useEffect(() => {
    if (!invite) return;
    const timer = setTimeout(() => setInvite(null), EXPIRY_MS);
    return () => clearTimeout(timer);
  }, [invite]);

  const receiveFocusHere = useCallback(
    (from: string, tabId: string, at: { x: number; y: number }, zoom: number) => {
      setInvite({ from, tabId, at, zoom });
    },
    [],
  );

  // The live invitation in a ref as well as in state, so accepting can read it
  // without doing the work inside a setState UPDATER: React runs those during
  // the render phase, and navigating from one updates the page while this is
  // rendering (which React says, loudly).
  const liveRef = useRef<FocusInvite | null>(null);
  liveRef.current = invite;

  const acceptFocus = useCallback(() => {
    const current = liveRef.current;
    if (!current) return;
    setInvite(null);
    // Tab first: centring a point on a tab you are not on yet would leave you
    // looking at the right coordinates of the wrong board.
    ref.current.onFollowTab(current.tabId);
    ref.current.onCentreOn(current.at, current.zoom);
  }, []);

  const dismissFocus = useCallback(() => setInvite(null), []);

  return { invite, receiveFocusHere, acceptFocus, dismissFocus };
}
