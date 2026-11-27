'use client';

// A Session tab's keys for the facilitator (docs/specs/026-plan/session-tabs.md "The action bar"): each of the kind's
// outcomes by its key (Refinement's R, S, F; Sprint Planning's C, S), J and K the next and previous card. Never while focus is in a field, never with a modifier, never under an
// open dialog, so typing in the card never decides it.
import { useEffect } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export type SessionKeyActions = {
  // A lower-case key -> what it decides.
  outcomes: Readonly<Record<string, () => void>>;
  next: () => void;
  previous: () => void;
};

// Whether a key pressed with `target` focused is typing rather than a command.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[role="dialog"], [aria-modal="true"]')) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useSessionKeys({ on, ...actions }: SessionKeyActions & { on: boolean }): void {
  const latest = useLatest(actions);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const { outcomes, next, previous } = latest.current;
      const act =
        key === 'j'
          ? next
          : key === 'k'
            ? previous
            : Object.hasOwn(outcomes, key)
              ? outcomes[key]
              : undefined;
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, latest]);
}
