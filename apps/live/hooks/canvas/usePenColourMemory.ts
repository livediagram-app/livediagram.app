'use client';

// Your colours (docs/specs/023-whiteboard/whiteboard.md "The colour picker"), in the user's synced
// preferences, written the way the other synced preferences are (the same owner, guest or signed
// in). The logic is pure, in lib/pen-colour-memory.

import { useMemo } from 'react';
import type { PenColour } from '@livediagram/document';
import {
  forgetPenColour,
  readPenColourMemory,
  rememberPenColour,
  withPenColourMemory,
  type PenColourMemory,
} from '@/lib/pen-colour-memory';
import { readUserPreferences } from '@/lib/user-preferences';
import type { WhiteboardDockPrefsDeps } from './useWhiteboardDockPrefs';
import { debugLog } from '@/lib/debug-log';

export type PenColourMemoryApi = PenColourMemory & {
  /** A colour was used: a custom one moves to the front of Your colours. */
  remember: (colour: PenColour | null) => void;
  /** Remove a custom colour from Your colours. */
  forget: (colour: string) => void;
};

export function usePenColourMemory({
  userPreferences,
  setUserPreferences,
  writeUserPreferences,
  ownerId,
}: WhiteboardDockPrefsDeps): PenColourMemoryApi {
  const memory = useMemo(() => readPenColourMemory(userPreferences), [userPreferences]);
  // Written off the FRESHEST stored preferences, not this render's snapshot: the PUT sends the
  // whole blob, so a stale base would undo other writes.
  const update = (change: (current: PenColourMemory) => PenColourMemory) => {
    const latest = readUserPreferences();
    const current = readPenColourMemory(latest);
    const next = change(current);
    if (next === current) return;
    const merged = withPenColourMemory(latest, next);
    setUserPreferences(merged);
    writeUserPreferences(merged, ownerId);
  };
  return {
    ...memory,
    remember: (colour) => update((m) => rememberPenColour(m, colour)),
    forget: (colour) => {
      debugLog('[whiteboard] custom colour removed from Your colours');
      update((m) => forgetPenColour(m, colour));
    },
  };
}
