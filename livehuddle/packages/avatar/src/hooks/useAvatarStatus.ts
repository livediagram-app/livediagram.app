// Your status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"): Available, Focusing, In a Meeting, Away
// and the rest, for the session. It is kept through a switch to Edit and back (Work Tracker 706, #710), and shows (and
// is published, and mutes the call for Do Not Disturb) only while you have a character: out of the mode this returns
// none, so a status held through Edit never reaches anyone. It clears only on None, or on leaving the Space (the
// editor unmounting). Picking one is counted only when it changes something.

import { useState } from 'react';
import type { AvatarStatus } from '../status';
import { avatarBindings } from '../bindings';

export function useAvatarStatus(
  inMode: boolean,
): [AvatarStatus | null, (next: AvatarStatus | null) => void] {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  const pick = (next: AvatarStatus | null) => {
    // Re-picking the one already set (or None with none set) changes nothing, so it is not an event.
    if (next === status) return;
    avatarBindings.track('UI', 'Changed', 'AvatarStatus');
    setStatus(next);
  };
  return [inMode ? status : null, pick];
}
