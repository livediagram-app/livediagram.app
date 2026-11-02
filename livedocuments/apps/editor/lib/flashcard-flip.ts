// The flip (docs/specs/007-editor/flashcards.md "Flipping"): going to another card in a stack turns
// the card in front over its top edge instead of gliding the view along the row. Drawn over the
// canvas as a picture of the cards (a copy of their sheet and writing, inert), so the real card in
// front is ready for the caret and presses at once. One flip at a time: a second finishes the first.
import type { PageRect } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';

export const FLASHCARD_FLIP_MS = 420;
// In canvas px (the world is scaled by the zoom): deep enough that the turn reads as a card's.
const PERSPECTIVE = 2400;
// How far over the top edge the card turns before it has faded away.
const TURNED = 'rotateX(78deg)';
const FLAT = 'rotateX(0deg)';

type FlipPage = { id: string; rect: PageRect; flow?: string | undefined };

/** A card as it shows now, kept to be drawn over the canvas while it flips. */
export type CardPicture = { el: HTMLElement; world: HTMLElement };

// Attributes a copy must not carry: what other code finds the real card (and its writing) by,
// and what makes it a control.
const SCRUB = [
  'id',
  'data-page-id',
  'data-article-flow',
  'data-tour-id',
  'data-add-page-like',
  'contenteditable',
  'role',
  'aria-label',
  'tabindex',
];

function scrubbed(node: Element): HTMLElement {
  const copy = node.cloneNode(true) as HTMLElement;
  for (const el of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    for (const name of SCRUB) el.removeAttribute(name);
  }
  return copy;
}

/** A picture of the card (its sheet and its writing) as it shows now, or null where it is not on
 *  the canvas. */
export function pictureCard(page: FlipPage, root: ParentNode = document): CardPicture | null {
  const sheet = root.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(page.id)}"]`);
  const world = sheet?.parentElement;
  if (!sheet || !world) return null;
  // Its parts at their places on the canvas, moved as one so the card's corner is the picture's.
  const inner = document.createElement('div');
  inner.style.position = 'absolute';
  inner.style.left = `${-page.rect.x}px`;
  inner.style.top = `${-page.rect.y}px`;
  inner.appendChild(scrubbed(sheet));
  const flow = page.flow
    ? root.querySelector(`.article-flow[data-article-flow="${CSS.escape(page.flow)}"]`)
    : null;
  if (flow) inner.appendChild(scrubbed(flow));
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-flashcard-flip', '');
  el.inert = true;
  el.style.position = 'absolute';
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.transformOrigin = 'top center';
  el.appendChild(inner);
  return { el, world };
}

/** Whether motion is asked to be calm: the OS setting or the editor's own Reduce Motion. */
export function motionReduced(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

let running: (() => void) | null = null;

/** Finishes a flip under way at once (its picture taken away). */
export function finishFlip(): void {
  running?.();
}

/** Flips from the card that was in front (`from`, its picture taken before it went) to `to`, the
 *  card now in front. Forward, `from` turns away over its top edge, uncovering `to`; back, `to`
 *  comes over its top edge onto `from`. Nothing under reduced motion, or without a picture. */
export function flipCard(
  from: CardPicture | null,
  to: FlipPage,
  forward: boolean,
  reduced = motionReduced(),
): void {
  finishFlip();
  if (!from || reduced) return;
  const layers: HTMLElement[] = [];
  const place = (el: HTMLElement) => {
    el.style.left = `${to.rect.x}px`;
    el.style.top = `${to.rect.y}px`;
    el.style.width = `${to.rect.width}px`;
    el.style.height = `${to.rect.height}px`;
    from.world.appendChild(el);
    layers.push(el);
  };
  place(from.el);
  const turned = { transform: `perspective(${PERSPECTIVE}px) ${TURNED}`, opacity: 0 };
  const flat = { transform: `perspective(${PERSPECTIVE}px) ${FLAT}`, opacity: 1 };
  let moving = from.el;
  let frames = [flat, turned];
  if (!forward) {
    // Back: the card that was in front stays put while the earlier card comes back over it.
    const next = pictureCard(to, from.world);
    if (next) {
      place(next.el);
      moving = next.el;
      frames = [turned, flat];
    }
  }
  const anim = moving.animate?.(frames, {
    duration: FLASHCARD_FLIP_MS,
    easing: 'ease-in-out',
    fill: 'forwards',
  });
  const done = () => {
    if (running !== done) return;
    running = null;
    anim?.cancel();
    for (const el of layers) el.remove();
  };
  running = done;
  if (anim) anim.onfinish = done;
  else done();
  track('UI', 'Used', 'FlashcardFlip');
  debugLog('[flashcard] flip', { to: to.id, forward });
}
