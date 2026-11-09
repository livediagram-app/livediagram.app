// Your status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"): Available, Focusing, In a Meeting or
// Away, for the session only, cleared on leaving the mode (adjusted during render, so a stale one is never
// published). Picking one is counted only when it changes something.

import { useState } from 'react';
import type { AvatarStatus } from '../status';
import { avatarBindings } from '../bindings';

export function useAvatarStatus(
  inMode: boolean,
): [AvatarStatus | null, (next: AvatarStatus | null) => void] {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  if (!inMode && status !== null) setStatus(null);
  const pick = (next: AvatarStatus | null) => {
    // Re-picking the one already set (or None with none set) changes nothing, so it is not an event.
    if (next === status) return;
    avatarBindings.track('UI', 'Changed', 'AvatarStatus');
    setStatus(next);
  };
  return [status, pick];
}
