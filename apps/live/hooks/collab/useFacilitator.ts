'use client';

// The facilitator baton, from this browser's side (docs/specs/012-collaboration/facilitator.md): who holds it,
// whether that is us, and the three asks that move it.
//
// The room arbitrates, so nothing here decides anything — it sends an ask and
// waits for the answer everybody else gets too. What it does own is the
// TOKEN: the secret the room hands the holder, kept in `sessionStorage` so a
// refresh presents it on the next hello and the baton comes straight back.
// `sessionStorage` rather than `localStorage` on purpose: a baton is a thing
// about right now, and a second tab opened on the same document is a different
// seat at the table, not the same one.

import { useCallback, useState } from 'react';
import type { FacilitatorReason } from '@liveplanner/api-schema';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';

/** Where a document's baton token lives while the tab is open. */
const tokenKey = (documentId: string) => `liveplanner:facilitator:${documentId}`;

function readToken(documentId: string | null): string | null {
  if (!documentId || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(tokenKey(documentId));
  } catch {
    // Private windows and blocked site data both throw here. A lost token
    // costs the holder their baton on the next refresh, nothing worse.
    return null;
  }
}

function writeToken(documentId: string | null, token: string | null): void {
  if (!documentId || typeof window === 'undefined') return;
  try {
    if (token) window.sessionStorage.setItem(tokenKey(documentId), token);
    else window.sessionStorage.removeItem(tokenKey(documentId));
  } catch {
    /* see readToken */
  }
}

type FacilitatorApi = {
  /** The holder's presence id, or null when nobody is facilitating. */
  facilitatorId: string | null;
  /**
   * The holder's name: as the roster has it, else as last seen, so the 90 seconds an absent holder keeps the
   * baton still name them (docs/specs/012-collaboration/facilitator.md). Null when nobody holds it or a holder was
   * never seen.
   */
  facilitatorName: string | null;
  /** Are we the ones running this session? */
  isFacilitator: boolean;
  /**
   * Is a session tool somebody else's to press right now? False whenever the
   * baton is free, which is what keeps an untouched room behaving as it always
   * has.
   */
  sessionToolsBlocked: boolean;
  /** Take a free baton, or take one back as the owner. */
  claimFacilitator: () => void;
  /** Hand it to a presence id. */
  grantFacilitator: (presenceId: string) => void;
  /** Step down. */
  releaseFacilitator: () => void;
  /**
   * Free an element a peer is holding through the concurrent-selection lock
   * (docs/specs/007-editor/live-app.md), so the session can get on with it. The room arbitrates: it
   * refuses unless the baton is ours or free, and tells the holder alone.
   */
  releaseSelectionLock: (presenceId: string, elementId: string) => void;
  /**
   * May we free somebody's lock right now? The same rule the session tools
   * use — ours, or nobody's — so the affordance is not invisible in the
   * ordinary room where no baton was ever claimed.
   */
  canReleaseSelectionLock: boolean;
  /** Feed the room's answer in (wired to the socket handler). */
  receiveFacilitator: (msg: {
    holder: string | null;
    by?: string;
    reason: FacilitatorReason;
    token?: string;
  }) => void;
  /** What the socket presents on its next hello. */
  readFacilitatorToken: () => string | null;
};

export function useFacilitator(deps: {
  documentId: string | null;
  /** Send one frame to the room. No-op before the socket is up. */
  send: (
    msg:
      | { kind: 'facilitator'; action: 'claim' | 'release' }
      | { kind: 'facilitator'; action: 'grant'; to: string }
      | { kind: 'facilitator'; action: 'unlock'; target: string; elementId: string },
  ) => void;
  /** Announce a change to this user, gated by their notification preference. */
  onNotice: (message: string) => void;
  /** Resolve a presence id to a name for those announcements; null for somebody no longer present. */
  nameOf: (presenceId: string) => string | null;
}): FacilitatorApi {
  const { documentId } = deps;
  const [facilitatorId, setFacilitatorId] = useState<string | null>(null);
  // Whether the baton is OURS is not something we can work out by comparing
  // ids: the room mints a presence id per socket and never tells you which one
  // is yours (docs/specs/015-api/public-api-and-tokens.md §6). The token is the answer. It rides only the holder's
  // copy of the frame, so "this frame carried a token" means "you are the
  // facilitator", and any frame without one means you are not.
  const [isFacilitator, setIsFacilitator] = useState(false);
  // Live deps so the socket handler never reads a stale closure: it is wired
  // once, and the names it announces change every time somebody renames.
  const ref = useLatest(deps);
  // The holder's name as last seen. An absent holder keeps the baton a while, and by the time the room says
  // they timed out (docs/specs/012-collaboration/facilitator.md "Telling the room") they have left the
  // roster, so both the blocked buttons and the announcement name them from here. Kept in step during render
  // (a roster read, only when somebody holds it), and dropped with the baton.
  const [lastSeen, setLastSeen] = useState<{ id: string; name: string } | null>(null);
  const rosterName = facilitatorId ? deps.nameOf(facilitatorId) : null;
  if (
    facilitatorId &&
    rosterName &&
    (lastSeen?.id !== facilitatorId || lastSeen.name !== rosterName)
  )
    setLastSeen({ id: facilitatorId, name: rosterName });
  if (!facilitatorId && lastSeen) setLastSeen(null);
  const facilitatorName =
    rosterName ?? (facilitatorId && lastSeen?.id === facilitatorId ? lastSeen.name : null);
  const lastSeenRef = useLatest(lastSeen);

  // A different document is a different session, reset during render.
  const [sessionDocumentId, setSessionDocumentId] = useState(documentId);
  if (documentId !== sessionDocumentId) {
    setSessionDocumentId(documentId);
    setFacilitatorId(null);
    setIsFacilitator(false);
    setLastSeen(null);
  }

  const readFacilitatorToken = useCallback(() => readToken(ref.current.documentId), [ref]);

  const receiveFacilitator = useCallback(
    (msg: { holder: string | null; by?: string; reason: FacilitatorReason; token?: string }) => {
      const { onNotice } = ref.current;
      // One lookup for every sentence: the roster, else the holder as last seen (gone by a 'left').
      const held = lastSeenRef.current;
      const nameOf = (id: string) =>
        ref.current.nameOf(id) ?? (held?.id === id ? held.name : null) ?? 'Somebody';
      const mine = msg.token !== undefined;
      setFacilitatorId(msg.holder);
      setIsFacilitator(mine);
      if (mine) writeToken(ref.current.documentId, msg.token!);
      else writeToken(ref.current.documentId, null);
      // 'state' is the room catching a joiner up. Nothing happened, so nothing
      // is announced: a toast on arrival would report somebody else's standing
      // news as if it were an event.
      if (msg.reason === 'state') return;
      if (msg.reason === 'left') {
        onNotice(`${nameOf(msg.by ?? '')} left, so nobody is facilitating`);
        return;
      }
      if (msg.holder === null) {
        onNotice('Nobody is facilitating now');
        return;
      }
      if (mine) {
        // Taking it yourself is not news you need told back to you, but being
        // handed it is: it changes what your screen will let you do.
        onNotice(
          msg.reason === 'claim'
            ? 'You are facilitating this session'
            : `${nameOf(msg.by ?? '')} made you the facilitator`,
        );
        return;
      }
      onNotice(`${nameOf(msg.holder)} is now facilitating`);
    },
    [ref, lastSeenRef],
  );

  // Telemetry (docs/specs/017-telemetry/telemetry.md) on the ASK rather than the answer: a refused ask is
  // worth knowing about, and the answer arrives at every client, which would
  // count one move as many.
  const claimFacilitator = useCallback(() => {
    ref.current.send({ kind: 'facilitator', action: 'claim' });
    track('Facilitator', 'Started', 'Claimed');
  }, [ref]);

  const grantFacilitator = useCallback(
    (presenceId: string) => {
      ref.current.send({ kind: 'facilitator', action: 'grant', to: presenceId });
      track('Facilitator', 'Changed', 'Granted');
    },
    [ref],
  );

  const releaseFacilitator = useCallback(() => {
    ref.current.send({ kind: 'facilitator', action: 'release' });
    track('Facilitator', 'Ended', 'Released');
  }, [ref]);

  const releaseSelectionLock = useCallback(
    (presenceId: string, elementId: string) => {
      ref.current.send({ kind: 'facilitator', action: 'unlock', target: presenceId, elementId });
      track('Facilitator', 'Changed', 'Unlocked');
    },
    [ref],
  );

  return {
    facilitatorId,
    facilitatorName,
    isFacilitator,
    sessionToolsBlocked: facilitatorId !== null && !isFacilitator,
    claimFacilitator,
    grantFacilitator,
    releaseFacilitator,
    releaseSelectionLock,
    canReleaseSelectionLock: facilitatorId === null || isFacilitator,
    receiveFacilitator,
    readFacilitatorToken,
  };
}
