'use client';

// The whiteboard dock's synced preferences (docs/specs/023-whiteboard/whiteboard.md "Shape slots",
// "Where the dock sits"): the pinned shapes, the pick counts and the dock's position, written the way the other synced preferences are (the same owner, guest or signed in). The logic is pure, in
// lib/whiteboard-dock-prefs and lib/whiteboard-shape-slots.

import { useMemo } from 'react';
import { track } from '@/lib/telemetry';
import { readUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  readWhiteboardDockPosition,
  readWhiteboardDockPrefs,
  withWhiteboardDockPrefs,
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
  const { pinned, picks } = useMemo(
    () => readWhiteboardDockPrefs(userPreferences),
    [userPreferences],
  );
  // Set in Settings (Editor, Whiteboard); read here so the dock follows a change at once.
  const position = readWhiteboardDockPosition(userPreferences);
  // The Shapes flyout's slots: Most used and Recent.
  const slots = useMemo(() => shapeSlots(picks, pinned), [picks, pinned]);

  // Written off the FRESHEST stored preferences, not this render's snapshot: the PUT sends the
  // whole blob, so a stale base would undo other writes.
  const update = (patch: (current: WhiteboardDockPrefs) => Partial<WhiteboardDockPrefs>) => {
    const latest = readUserPreferences();
    const merged = withWhiteboardDockPrefs(latest, patch(readWhiteboardDockPrefs(latest)));
    setUserPreferences(merged);
    writeUserPreferences(merged, ownerId);
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

  return { pinned, slots, position, recordPick, applySlotOutcome };
}
