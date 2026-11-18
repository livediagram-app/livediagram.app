// Avatar-mode keyboard slice (docs/specs/008-canvas/avatar-mode.md): the held-arrow steering flags and
// the Space jump trigger, split out of useAvatarWalk so that hook keeps to
// state + the animation loop.
//
// Arrows are read as a HELD set (the walk loop turns them into a direction
// each frame) rather than per-keydown steps, so steering feels continuous.
// Space is a one-shot: the jump + flag wave fires on the initial press and
// autorepeat is ignored, so holding Space doesn't pogo.

import { useEffect } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { walkInputBlocked } from '../walk-guard';
import { avatarKeyClaimed } from '../key-claims';
import { planDir } from '../arrow-turn';

export type AvatarHeldKeys = { up: boolean; down: boolean; left: boolean; right: boolean };

export const NO_KEYS_HELD: AvatarHeldKeys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const ARROW_KEYS: Record<string, keyof AvatarHeldKeys> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// The plan directions the held screen arrows steer.
function heldFrom(pressed: ReadonlySet<keyof AvatarHeldKeys>): AvatarHeldKeys {
  const held = { ...NO_KEYS_HELD };
  for (const d of pressed) held[planDir(d)] = true;
  return held;
}

export function useAvatarKeys({
  active,
  heldRef,
  onSteer,
  onJump,
}: {
  active: boolean;
  // Mutated in place (not state): the walk loop reads it every frame.
  heldRef: React.RefObject<AvatarHeldKeys>;
  // Fired when a new arrow goes down, so the caller can cancel a
  // click-walk that would fight the steering.
  onSteer: () => void;
  // Space: jump + wave the flag.
  onJump: () => void;
}) {
  // The listeners attach once per mode entry, so they must reach the LATEST
  // callbacks rather than the closures from the render that attached them
  // (the same live-ref convention useEditorKeyboardShortcuts documents).
  const liveRef = useLatest({ onSteer, onJump });

  useEffect(() => {
    if (!active) return;
    // The arrows held on the keyboard, by the screen; what they steer is read through the 3D camera's turn (arrow-turn).
    const pressed = new Set<keyof AvatarHeldKeys>();
    const onKeyDown = (e: KeyboardEvent) => {
      // A panel input (search, rename), an open modal or a start screen in front of the canvas owns the keyboard
      // (walk-guard): arrowing through Start a Space's templates never walks the character behind it.
      if (isTypingTarget(e.target, { select: false }) || walkInputBlocked()) return;
      // A key a piece holds (a game's paddle, key-claims) is that piece's: it neither steers nor stands you up.
      if (avatarKeyClaimed(e)) return;
      const dir = ARROW_KEYS[e.key];
      if (dir) {
        e.preventDefault();
        // A held key repeats: only a new arrow steers afresh, so holding two never stutters the walk.
        if (!pressed.has(dir)) liveRef.current.onSteer();
        pressed.add(dir);
        heldRef.current = heldFrom(pressed);
        return;
      }
      // Space jumps. In every other mode Space is the hold-to-pan modifier
      // (and tap-to-edit-label); avatar mode is read-only with nothing
      // selectable, so the key is free for the character. Autorepeat from a
      // held key is ignored — one press, one hop.
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        liveRef.current.onJump();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = ARROW_KEYS[e.key];
      if (dir) {
        pressed.delete(dir);
        heldRef.current = heldFrom(pressed);
      }
    };
    // Held keys can't be trusted across a blur (the keyup lands on another
    // window), so drop them all rather than walking away forever.
    const onBlur = () => {
      pressed.clear();
      heldRef.current = { ...NO_KEYS_HELD };
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // onSteer / onJump are reached through liveRef, so the effect only
    // re-attaches when the mode flips (both refs are stable).
  }, [active, heldRef, liveRef]);
}
