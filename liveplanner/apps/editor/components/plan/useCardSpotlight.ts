'use client';

// The light that follows the pointer across a hovered card (docs/specs/026-plan/plan-board.md "Card hover"): one
// pointermove listener on the board's grid writes the pointer's spot on the card under it as --card-mx / --card-my,
// at most once a frame, straight to the DOM (no React render). Mouse and pen only; a touch has no hover.
import { useEffect, type RefObject } from 'react';

const CARD = '.plan-card-hover';
/** The custom properties the light is written to, on the card itself. */
export const SPOTLIGHT_X = '--card-mx';
export const SPOTLIGHT_Y = '--card-my';

export function useCardSpotlight(gridRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !enabled) return;
    let frame = 0;
    let last: { card: HTMLElement; x: number; y: number } | null = null;
    const paint = () => {
      frame = 0;
      if (!last) return;
      const { card, x, y } = last;
      const box = card.getBoundingClientRect();
      card.style.setProperty(SPOTLIGHT_X, `${Math.round(x - box.left)}px`);
      card.style.setProperty(SPOTLIGHT_Y, `${Math.round(y - box.top)}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const card = (e.target as Element | null)?.closest?.(CARD);
      if (!(card instanceof HTMLElement)) return;
      last = { card, x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    grid.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      grid.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [gridRef, enabled]);
}
