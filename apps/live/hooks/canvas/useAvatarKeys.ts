// Avatar-mode keyboard slice (spec/101): the held-arrow steering flags and
// the Space jump trigger, split out of useAvatarWalk so that hook keeps to
// state + the animation loop.
//
// Arrows are read as a HELD set (the walk loop turns them into a direction
// each frame) rather than per-keydown steps, so steering feels continuous.
// Space is a one-shot: the jump + flag wave fires on the initial press and
// autorepeat is ignored, so holding Space doesn't pogo.

import { useEffect, useRef } from 'react';
import { anyModalOpen } from '@/lib/modal-guard';

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

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  (t instanceof HTMLElement && t.isContentEditable);

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
  const liveRef = useRef({ onSteer, onJump });
  liveRef.current = { onSteer, onJump };

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // A panel input (search, rename) or an open modal owns the keyboard.
      if (isTypingTarget(e.target) || anyModalOpen()) return;
      const dir = ARROW_KEYS[e.key];
      if (dir) {
        e.preventDefault();
        liveRef.current.onSteer();
        heldRef.current = { ...heldRef.current, [dir]: true };
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
      if (dir) heldRef.current = { ...heldRef.current, [dir]: false };
    };
    // Held keys can't be trusted across a blur (the keyup lands on another
    // window), so drop them all rather than walking away forever.
    const onBlur = () => {
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
    // onSteer / onJump are reached through liveRef, so the effect only needs
    // to re-attach when the mode flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
