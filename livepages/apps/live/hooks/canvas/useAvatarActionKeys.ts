// The Avatar Panel's actions on the keyboard (docs/specs/008-canvas/avatar-mode.md "Keyboard actions"): while the
// mode is on, a Behaviour letter or a Reaction digit (lib/avatar-action-keys) plays it as the panel's button would.
// Stands aside while someone types (the message popover, a rename, a comment), while a dialog or a menu holds the
// keyboard, and for a key a closer handler already claimed.

import { useEffect } from 'react';
import { isInMenuSurface } from '@livepages/ui';
import type { Reaction } from '@livepages/document';
import { anyModalOpen } from '@/lib/modal-guard';
import { avatarActionForKey } from '@/lib/avatar-action-keys';
import type { AvatarReactionKind } from '@/lib/avatar-reactions';
import { isTypingTarget } from '@/lib/typing-target';
import { useLatest } from '@/hooks/ui/useLatest';

export function useAvatarActionKeys({
  active,
  onReaction,
  onBurst,
}: {
  active: boolean;
  onReaction: (kind: AvatarReactionKind) => void;
  onBurst: (reaction: Reaction) => void;
}): void {
  const liveRef = useLatest({ onReaction, onBurst });
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || anyModalOpen()) return;
      if (isInMenuSurface(e.target)) return;
      const action = avatarActionForKey(e);
      if (!action) return;
      e.preventDefault();
      if (action.type === 'behaviour') liveRef.current.onReaction(action.kind);
      else liveRef.current.onBurst(action.reaction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, liveRef]);
}
