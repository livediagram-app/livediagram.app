'use client';

// The whiteboard dock's synced preferences (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard
// shows", "Shape slots"): the dock mode, the pinned shapes and the pick counts, written the way the
// other synced preferences are (the same owner, guest or signed in). The logic is pure, in
// lib/whiteboard-dock-prefs and lib/whiteboard-shape-slots.

import { useMemo } from 'react';
import { track } from '@/lib/telemetry';
import { readUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  readWhiteboardDockPrefs,
  withWhiteboardDockPrefs,
  type WhiteboardDockMode,
  type WhiteboardDockPrefs,
} from '@/lib/whiteboard-dock-prefs';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { recordShapePick, shapeSlots, type SlotOutcome } from '@/lib/whiteboard-shape-slots';

export type WhiteboardDockPrefsDeps = {
  userPreferences: UserPreferences;
  setUserPreferences: (prefs: UserPreferences) => void;
  writeUserPreferences: (prefs: UserPreferences, ownerId?: string | null) => void;
  ownerId: string | null;
};

export function useWhiteboardDockPrefs({
  userPreferences,
  setUserPreferences,
  writeUserPreferences,
  ownerId,
}: WhiteboardDockPrefsDeps) {
  const { mode, pinned, picks } = useMemo(
    () => readWhiteboardDockPrefs(userPreferences),
    [userPreferences],
  );
  // The most-used slot, then the two last-used ones.
  const slots = useMemo(() => shapeSlots(picks, pinned), [picks, pinned]);

  // Written off the FRESHEST stored preferences, not this render's snapshot: the PUT sends the
  // whole blob, so a stale base would undo other writes.
  const update = (patch: (current: WhiteboardDockPrefs) => Partial<WhiteboardDockPrefs>) => {
    const latest = readUserPreferences();
    const merged = withWhiteboardDockPrefs(latest, patch(readWhiteboardDockPrefs(latest)));
    setUserPreferences(merged);
    writeUserPreferences(merged, ownerId);
  };

  const setMode = (next: WhiteboardDockMode) => {
    if (next === mode) return;
    // Before the write, so an opt-out still reaches the wire.
    track('Whiteboard', 'Changed', next === 'simple' ? 'ModeSimple' : 'ModeShapes');
    update(() => ({ mode: next }));
  };

  const recordPick = (key: WhiteboardShapeKey) =>
    update((current) => ({ picks: recordShapePick(current.picks, key, Date.now()) }));

  // A slot drop or a slot menu choice. A refusal writes nothing; the dock shows its hint.
  const applySlotOutcome = (outcome: SlotOutcome) => {
    if (outcome.type !== 'pin' && outcome.type !== 'unpin') return;
    const change = outcome.pinned.length - pinned.length;
    if (change > 0) track('Whiteboard', 'Changed', 'ShapePinned');
    if (change < 0) track('Whiteboard', 'Changed', 'ShapeUnpinned');
    // A replacement unpins one kind and pins another.
    if (change === 0 && outcome.pinned.some((k) => !pinned.includes(k))) {
      track('Whiteboard', 'Changed', 'ShapePinned');
    }
    update(() => ({ pinned: outcome.pinned }));
  };

  return { mode, pinned, slots, setMode, recordPick, applySlotOutcome };
}
