'use client';

// A Session tab's keys for the facilitator (docs/specs/026-plan/session-tabs.md "The action bar"): R Refined, S Skip,
// F Flag, J and K the next and previous card. Never while focus is in a field, never with a modifier, never under an
// open dialog, so typing in the card never decides it.
import { useEffect } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export type SessionKeyActions = {
  refine: () => void;
  skip: () => void;
  flag: () => void;
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
      const act = {
        r: latest.current.refine,
        s: latest.current.skip,
        f: latest.current.flag,
        j: latest.current.next,
        k: latest.current.previous,
      }[e.key.toLowerCase()];
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, latest]);
}
