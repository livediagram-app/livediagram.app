'use client';

// The picker's keyboard (docs/specs/004-interface-design/colour-picker.md "Keyboard"): the arrows
// move focus through every swatch and + in reading order, wrapping; Home and End jump to the ends.
// Moving focus never picks: Enter or Space (a button's own keys) does.
import type { KeyboardEvent } from 'react';

const STEP: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** Where a key moves focus among `count` keys from `at`, or -1 for a key that does not move it. */
export function colourKeyTarget(key: string, at: number, count: number): number {
  if (count <= 0 || at < 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = STEP[key];
  return step ? (at + step + count) % count : -1;
}

/** The root's keydown: the keys are its `[data-colour-key]` buttons, in DOM order. */
export function onColourKeys(e: KeyboardEvent<HTMLElement>): void {
  // The custom colour editor's own controls (its square, its hue slider) keep their arrows.
  if (!(e.target instanceof HTMLElement) || !e.target.hasAttribute('data-colour-key')) return;
  const keys = Array.from(
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-colour-key]:not([disabled])'),
  );
  const next = colourKeyTarget(e.key, keys.indexOf(e.target as HTMLButtonElement), keys.length);
  if (next < 0) return;
  e.preventDefault();
  e.stopPropagation();
  keys[next]?.focus();
}
