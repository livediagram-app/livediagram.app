'use client';

// The card panel grows out of the card it opens and shrinks back into it (docs/specs/026-plan/plan-board.md "Open an
// item"): on open, the Dialog's panel starts on the clicked card's box and eases to its own, its content fading up as
// it lands; on close, while that card is on screen, it eases back onto the card, the dim fading, before it goes. One
// Web Animations pass each way, on the panel the Dialog already draws (found from a probe inside it). A phone's sheet
// keeps its own rise, and reduced motion, a card off screen or one not on any board keep the Dialog's own fade.
import { useCallback, useLayoutEffect, useRef } from 'react';

const OPEN_MS = 360;
const CLOSE_MS = 260;
const EASE = 'cubic-bezier(0.2, 0.9, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 0.7, 0.2)';

function cardBox(itemId: string): DOMRect | null {
  const card = document.querySelector<HTMLElement>(`[data-plan-card="${CSS.escape(itemId)}"]`);
  if (!card) return null;
  const box = card.getBoundingClientRect();
  const onScreen =
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth;
  return onScreen ? box : null;
}

function mayMorph(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(min-width: 640px)').matches
  );
}

// The transform that lays a panel at `from` onto the box `to`.
function onto(from: DOMRect, to: DOMRect): string {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${to.width / from.width}, ${to.height / from.height})`;
}

export function useCardMorph(itemId: string, onClose: () => void) {
  const probe = useRef<HTMLSpanElement>(null);
  const closing = useRef(false);
  const panelOf = () => probe.current?.closest<HTMLElement>('[data-dialog-panel]') ?? null;
  // The panel opens once (it then moves from card to card in place): the first card's box only.
  const opened = useRef(false);
  // Opens once per mount; the card id at that moment is the one it grew from.
  useLayoutEffect(() => {
    if (opened.current) return;
    const box = cardBox(itemId);
    if (!box || !mayMorph()) return;
    // The Dialog's panel settles a frame after it mounts (its portal and size queries): morph the one that stays,
    // hidden until then so it never shows full size first.
    const first = panelOf();
    if (first) first.style.opacity = '0';
    const frame = requestAnimationFrame(() => {
      // Marked here, not before: a dev double effect cancels the first frame and must still morph.
      opened.current = true;
      if (first) first.style.opacity = '';
      const panel = panelOf();
      if (!panel || typeof panel.animate !== 'function') return;
      const own = panel.getBoundingClientRect();
      if (own.width === 0 || own.height === 0) return;
      panel.animate(
        [
          { transform: onto(own, box), opacity: 0.4, borderRadius: '12px' },
          { transform: 'none', opacity: 1 },
        ],
        { duration: OPEN_MS, easing: EASE },
      );
      for (const child of panel.children)
        (child as HTMLElement).animate?.([{ opacity: 0 }, { opacity: 1 }], {
          duration: 220,
          delay: 120,
          easing: 'ease-out',
          fill: 'backwards',
        });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (first) first.style.opacity = '';
    };
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    const panel = panelOf();
    const box = cardBox(itemId);
    if (!panel || !box || !mayMorph() || typeof panel.animate !== 'function') {
      onClose();
      return;
    }
    closing.current = true;
    const own = panel.getBoundingClientRect();
    for (const child of panel.children)
      (child as HTMLElement).animate?.([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120,
        easing: 'ease-in',
        fill: 'forwards',
      });
    panel.parentElement?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
      duration: CLOSE_MS,
      easing: 'ease-in',
      fill: 'forwards',
    });
    const morph = panel.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: onto(own, box), opacity: 0.3, borderRadius: '12px' },
      ],
      { duration: CLOSE_MS, easing: EASE_IN, fill: 'forwards' },
    );
    // Gone either way: when the morph ends, or if it is cancelled.
    let gone = false;
    const done = () => {
      if (gone) return;
      gone = true;
      closing.current = false;
      onClose();
    };
    morph.finished.then(done, done);
  }, [itemId, onClose]);

  return { probe, close };
}
