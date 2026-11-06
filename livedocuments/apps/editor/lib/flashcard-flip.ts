// The flip (docs/specs/007-editor/flashcards.md "Flipping"): going to another page in a stack (flashcards, infographic
// pages) turns the page in front over its top edge instead of gliding the view along the row. Drawn over the canvas
// as a picture of the pages (a copy of their sheet and writing, or an infographic page's elements, inert), so the real
// page in front is ready for the caret and presses at once. One flip at a time: a second finishes the first.
import type { PageRect } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';

// Short and small (flashcards.md "Flipping"): a flip happens again and again while someone talks, so it reads at a
// glance and never pulls the eye.
export const FLASHCARD_FLIP_MS = 240;
// In canvas px (the world is scaled by the zoom): deep enough that the slight tilt reads as a card's.
const PERSPECTIVE = 2400;
// Where the card leaving forward has gone once it has faded: tipped back a little over its top edge, lifted a touch and a shade
// smaller, as a card picked off the top of a pile.
const LIFTED = 'rotateX(14deg) translateY(-3%) scale(0.985)';
// Going back, the card leaving sinks toward the stack instead: tipped the other way, lowered a touch.
const SUNK = 'rotateX(-10deg) translateY(2%) scale(0.985)';
const FLAT = 'rotateX(0deg) translateY(0) scale(1)';

type FlipPage = { id: string; rect: PageRect; flow?: string | undefined };

/** A card as it shows now, kept to be drawn over the canvas while it flips. */
export type CardPicture = { el: HTMLElement; world: HTMLElement };

// Attributes a copy must not carry: what other code finds the real card (and its writing) by,
// and what makes it a control.
const SCRUB = [
  'id',
  'data-page-id',
  'data-article-flow',
  'data-element-id',
  'data-page-clip',
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
  // An infographic page's elements: the element layer, cut to the page in front (PageClip shows that page alone).
  const clip = page.flow ? null : world.querySelector('[data-page-clip]');
  if (clip) inner.appendChild(scrubbed(clip));
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
 *  card now in front. Only the card leaving moves: the real card now in front is drawn under it from the first frame,
 *  its writing on, so nothing waits for the flip to end. Forward, the leaving card lifts away over its top edge; back,
 *  it sinks away toward the stack. Nothing under reduced motion, or without a picture. */
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
  const moving = from.el;
  const frames = [
    { transform: `perspective(${PERSPECTIVE}px) ${FLAT}`, opacity: 1 },
    { transform: `perspective(${PERSPECTIVE}px) ${forward ? LIFTED : SUNK}`, opacity: 0 },
  ];
  const anim = moving.animate?.(frames, {
    duration: FLASHCARD_FLIP_MS,
    // Settles quickly: most of the move is over in the first half, so the next card is readable at once.
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
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
