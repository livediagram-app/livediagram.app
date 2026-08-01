'use client';

import { useCallback, useRef, useState } from 'react';

import { isReaction, REACTION_DEFAULT, type Reaction } from '@livediagram/diagram';

// The reaction bursts currently playing (spec/135).
//
// Ephemeral, per-client, and never document state: a burst is not stored, not
// undoable, and not replayed to somebody who joins after it finished. It plays
// and it is gone, which is why the room op that carries it is in the
// never-logged set beside cursor / laser / avatar.
//
// Keyed by ELEMENT id, so a pad can only be mid-burst once. Hammering a pad
// therefore restarts its burst rather than stacking twelve of them into a
// smear, which is both what it looks like it should do and what stops a
// leaning-on-the-button moment from putting two hundred spans on the canvas.

export type ActiveBurst = { reaction: Reaction; seed: number };

export function useReactionBursts(): {
  bursts: Map<string, ActiveBurst>;
  /** Play a burst locally. Returns the reaction played, for the caller to broadcast. */
  play: (elementId: string, reaction: Reaction | undefined) => Reaction;
  /** Play one that arrived from a peer. Unknown reaction names fall back. */
  receive: (elementId: string, reaction: string) => void;
  clear: (elementId: string) => void;
} {
  const [bursts, setBursts] = useState<Map<string, ActiveBurst>>(new Map());
  // Monotonic, so every burst gets a distinct seed even on the same pad in the
  // same millisecond. Date.now() collides under a fast double-press, and the
  // seed is what makes React remount the particles.
  const seq = useRef(0);

  const start = useCallback((elementId: string, reaction: Reaction) => {
    seq.current += 1;
    const seed = seq.current;
    setBursts((prev) => {
      const next = new Map(prev);
      next.set(elementId, { reaction, seed });
      return next;
    });
  }, []);

  const play = useCallback(
    (elementId: string, reaction: Reaction | undefined) => {
      const chosen = reaction ?? REACTION_DEFAULT;
      start(elementId, chosen);
      return chosen;
    },
    [start],
  );

  const receive = useCallback(
    (elementId: string, reaction: string) => {
      // A peer on a newer build could name a reaction this one has never heard
      // of. Playing the default beats playing nothing: the point of the press
      // was that something visible happened in the room.
      start(elementId, isReaction(reaction) ? reaction : REACTION_DEFAULT);
    },
    [start],
  );

  const clear = useCallback((elementId: string) => {
    setBursts((prev) => {
      if (!prev.has(elementId)) return prev;
      const next = new Map(prev);
      next.delete(elementId);
      return next;
    });
  }, []);

  return { bursts, play, receive, clear };
}
