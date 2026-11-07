// The Edit | Walk switch's morph, its DOM half (docs/specs/007-editor/toolbar-layout.md "Switching morphs the
// strip"; the numbers are lib/strip-morph.ts). Two steps, one measure each:
//
// 1. `captureStrip`, once React has rendered the switch and before it changes the DOM (StripMorph's
//    getSnapshotBeforeUpdate; the old strip is still on screen): the outgoing card's box and a still copy of it, to
//    fade out. Mid-morph (a quick second press) the box is the bar as drawn.
// 2. `playStripMorph`, in StripMorph's componentDidUpdate once the incoming strip is laid out, before it paints: a
//    bar behind the card resizes from the old box to the new, the card's contents clipped to it; the copy fades and
//    slides out, the new contents slide in from the other side; the toggle rides the bar's start edge and its pill
//    glides.
//
// Transform and opacity, plus the bar's own size (an absolute box with nothing in it, so nothing else re-lays out).
// The card's layout never changes, so nothing that measures the strip (its names, crowding, the corners) sees a
// frame of the morph. Reduced motion captures nothing, so the switch is instant.
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  arriveDelayMs,
  contentShift,
  morphFrames,
  STRIP_MORPH_EASE,
  STRIP_MORPH_MS,
  STRIP_IN_MS,
  STRIP_OUT_MS,
  type Box,
  type StripSide,
} from '@/lib/strip-morph';
import { CARD_CLASS } from './ToolbarPalette';

export type StripSnapshot = { box: Box; ghost: HTMLElement; radius: number };

const CARD = '[data-tour-id="palette"]';
const ROOT = '[data-toolbar-palette]';
const SURFACE = 'data-strip-morph-surface';
const GHOST = 'data-strip-morph-ghost';
// Attributes a copy must not carry: ids and anchors other code finds the strip by, and the split view's slide.
const STRIPPED = [
  'id',
  'data-tour-id',
  'data-toolbar-palette',
  'data-floating-panel',
  'data-split-chrome',
  'data-edit-walk',
  'data-edit-walk-toggle',
  'data-region',
];

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

const zoomOf = (el: HTMLElement): number => {
  const zoom = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof zoom === 'number' && zoom > 0 ? zoom : 1;
};

// The strip on screen inside `scope` (one editor's canvas; a split view has two), or null when none shows.
export function visibleStripCard(scope: ParentNode | null | undefined): HTMLElement | null {
  if (!scope) return null;
  for (const root of scope.querySelectorAll<HTMLElement>(ROOT)) {
    if (root.getClientRects().length === 0) continue;
    const card = root.querySelector<HTMLElement>(CARD);
    if (card) return card;
  }
  return null;
}

/** Step 1: the outgoing strip, read before the switch commits. Null when there is nothing to morph from. */
export function captureStrip(scope: ParentNode | null | undefined): StripSnapshot | null {
  if (prefersReducedMotion()) return null;
  const card = visibleStripCard(scope);
  if (!card) return null;
  // Mid-morph, the bar as drawn is what the eye sees, so the next morph starts from there.
  const surface = card.closest(ROOT)?.querySelector<HTMLElement>(`[${SURFACE}]`);
  const box = boxOf(surface ?? card);
  if (box.width <= 0) return null;
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.querySelectorAll(`[${GHOST}]`).forEach((n) => n.remove());
  for (const el of [ghost, ...ghost.querySelectorAll<HTMLElement>('*')])
    for (const name of STRIPPED) el.removeAttribute(name);
  // The ghost's toggle and its divider stay hidden: the incoming strip's own ride the bar's edge instead.
  const toggle = card.querySelector<HTMLElement>(':scope > [data-edit-walk-toggle]');
  if (toggle) {
    const i = [...card.children].indexOf(toggle);
    for (const n of [ghost.children[i], ghost.children[i + 1]])
      if (n instanceof HTMLElement) n.style.visibility = 'hidden';
  }
  const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
  return { box, ghost, radius };
}

/** Step 2: play the morph onto the incoming strip. Returns a cancel that puts everything back. */
export function playStripMorph(
  scope: ParentNode | null | undefined,
  from: StripSnapshot,
  to: StripSide,
): () => void {
  const card = visibleStripCard(scope);
  const root = card?.closest<HTMLElement>(ROOT);
  if (!card || !root) return () => {};
  // The card's own fade-in (the floating chrome's arrival) would replay on a strip coming back from hidden: off
  // for good, so it neither plays now nor restarts when the morph ends.
  card.style.animation = 'none';
  // Measured from a ResizeObserver's first call: it comes after the incoming strip's own settling (its names, its
  // crowding, its snapped width, whose observers run first) and still before the first paint, so the box is the
  // one the strip lands on and no frame shows it unmorphed.
  let stop: (() => void) | null = null;
  let cancelled = false;
  const ro = new ResizeObserver(() => {
    ro.disconnect();
    if (!cancelled) stop = startMorph(card, root, from, to);
  });
  ro.observe(card);
  return () => {
    cancelled = true;
    ro.disconnect();
    stop?.();
  };
}

function startMorph(
  card: HTMLElement,
  root: HTMLElement,
  from: StripSnapshot,
  to: StripSide,
): () => void {
  const toBox = boxOf(card);
  const zoom = zoomOf(card);
  const rootBox = root.getBoundingClientRect();
  const frames = morphFrames(from.box, toBox, rootBox, zoom, from.radius);
  const shift = contentShift(to);
  const timing = { duration: STRIP_MORPH_MS, easing: STRIP_MORPH_EASE };
  const animations: Animation[] = [];
  const restore: (() => void)[] = [];
  const setStyle = (el: HTMLElement, styles: Partial<Record<string, string>>) => {
    const was: Record<string, string> = {};
    for (const [k, v] of Object.entries(styles)) {
      was[k] = el.style.getPropertyValue(k);
      el.style.setProperty(k, v ?? '');
    }
    restore.push(() => {
      for (const [k, v] of Object.entries(was)) el.style.setProperty(k, v);
    });
  };

  // The bar: the card's own surface, drawn behind the contents and resized; the card's surface steps aside.
  const surface = document.createElement('div');
  surface.setAttribute(SURFACE, '');
  surface.setAttribute('aria-hidden', 'true');
  surface.className = CARD_CLASS;
  const [s0, s1] = frames.surface;
  Object.assign(surface.style, {
    position: 'absolute',
    margin: '0',
    padding: '0',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    left: `${s1.left}px`,
    top: `${s1.top}px`,
    width: `${s1.width}px`,
    height: `${s1.height}px`,
  });
  root.prepend(surface);
  restore.push(() => surface.remove());
  animations.push(
    surface.animate(
      [
        {
          left: `${s0.left}px`,
          top: `${s0.top}px`,
          width: `${s0.width}px`,
          height: `${s0.height}px`,
        },
        {
          left: `${s1.left}px`,
          top: `${s1.top}px`,
          width: `${s1.width}px`,
          height: `${s1.height}px`,
        },
      ],
      timing,
    ),
  );
  setStyle(card, {
    position: 'relative',
    background: 'transparent',
    'border-color': 'transparent',
    'box-shadow': 'none',
  });
  animations.push(
    card.animate([{ clipPath: frames.clip[0] }, { clipPath: frames.clip[1] }], timing),
  );

  // The outgoing contents: a still copy where the old card stood, fading and sliding toward the side they leave.
  const ghost = from.ghost;
  ghost.setAttribute(GHOST, '');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const border = getComputedStyle(card);
  Object.assign(ghost.style, {
    position: 'absolute',
    margin: '0',
    left: `${frames.ride - (parseFloat(border.borderLeftWidth) || 0)}px`,
    top: `${(from.box.top - toBox.top) / zoom - (parseFloat(border.borderTopWidth) || 0)}px`,
    width: `${from.box.width / zoom}px`,
    height: `${from.box.height / zoom}px`,
    background: 'transparent',
    borderColor: 'transparent',
    boxShadow: 'none',
    animation: 'none',
    pointerEvents: 'none',
    opacity: '0',
  });
  card.append(ghost);
  restore.push(() => ghost.remove());
  animations.push(
    ghost.animate(
      [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${shift.leave}px)` },
      ],
      { duration: STRIP_OUT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
    ),
  );

  // The toggle (and the divider after it) ride the bar's start edge; its pill glides to the side now on.
  const toggle = card.querySelector<HTMLElement>(':scope > [data-edit-walk-toggle]');
  const riders = toggle
    ? [toggle, toggle.nextElementSibling].filter((n): n is HTMLElement => n instanceof HTMLElement)
    : [];
  if (frames.ride !== 0)
    for (const rider of riders)
      animations.push(
        rider.animate(
          [{ transform: `translateX(${frames.ride}px)` }, { transform: 'translateX(0)' }],
          timing,
        ),
      );
  const pill = toggle?.querySelector<HTMLElement>(':scope > span[aria-hidden]');
  if (pill) {
    const was = to === 'walk' ? 0 : 1;
    const now = 1 - was;
    animations.push(
      pill.animate(
        [{ transform: `translateX(${was * 100}%)` }, { transform: `translateX(${now * 100}%)` }],
        timing,
      ),
    );
  }

  // The incoming contents slide in from the other side, a small cascade.
  let i = 0;
  for (const child of card.children) {
    if (!(child instanceof HTMLElement) || child === ghost || riders.includes(child)) continue;
    animations.push(
      child.animate(
        [
          { opacity: 0, transform: `translateX(${shift.arrive}px)` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        {
          duration: STRIP_IN_MS,
          delay: arriveDelayMs(i),
          easing: STRIP_MORPH_EASE,
          fill: 'backwards',
        },
      ),
    );
    i += 1;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    for (const a of animations) a.cancel();
    for (const undo of restore.reverse()) undo();
  };
  void Promise.all(animations.map((a) => a.finished)).then(finish, () => {});
  return finish;
}
