// How a Board or Sheet grows into the maximised layer and shrinks back (./MaximisedPlanLayer): the FLIP transform
// from its slot, the ghost left behind, the reported box size, Escape restoring it, and the open and close of the
// box itself. Re-exported from ./MaximisedPlanLayer.
import { useEffect } from 'react';
import { MENU_SURFACE_ATTR } from '@liveplanner/ui';
import { finishRestore, releasePlanElement, restorePlanElement } from '@/hooks/plan/maximised-plan';
import { MOTION_MS } from '@liveworkspace/style-guards/motion';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { announceHeaderBand } from './menu-name-slot';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

const GHOST_CLASSES = [
  'rounded-xl',
  'border',
  'border-slate-200',
  'bg-white',
  'shadow-2xl',
  'dark:border-slate-700',
  'dark:bg-slate-900',
];
// How long the content takes to fade in once the frame has grown.
const REVEAL_MS = 120;

// The transform that lays a box drawn at `to` over `from` (top-left origin): where the element sits on the canvas.
type BoxSize = { width: number; height: number };

// The box's laid-out size (untransformed, so the open animation never shows in it), for a view to fit: reported now
// and on every resize, and null when the box goes. Both maximised layers report through it.
export function useReportedBoxSize(
  boxRef: { current: HTMLElement | null },
  onSize: ((size: BoxSize | null) => void) | undefined,
  canvas: unknown,
): void {
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !onSize) return;
    const report = () => onSize({ width: box.offsetWidth, height: box.offsetHeight });
    report();
    if (typeof ResizeObserver === 'undefined') return () => onSize(null);
    const ro = new ResizeObserver(report);
    ro.observe(box);
    return () => {
      ro.disconnect();
      onSize(null);
    };
  }, [boxRef, onSize, canvas]);
}

export function flipTransform(from: DOMRect, to: DOMRect): string {
  if (to.width <= 0 || to.height <= 0) return 'none';
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

// Where the element is drawn on screen, measured at the moment it is asked: its slot (MaximisableSlot's own box, which
// stays in place while the body is away), else its canvas node. The slot is where it really is: in a Dashboard slot the
// element is drawn in the slot, while its canvas node sits out of sight under the page (plan-tabs.md "Slot content"),
// so growing from or shrinking to the canvas node would fly to a place the element is not.
export function originOf(id: string): DOMRect | null {
  const key = CSS.escape(id);
  for (const selector of [`[data-plan-slot="${key}"]`, elementSelector(key)]) {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) return box;
  }
  return null;
}

// Escape restores, unless a dialog over the element (the item panel, a confirm) or an open menu has it first
// (menus hear Escape on the project, after this capture listener), or the key is pressed inside something that
// uses Escape itself (`data-keeps-escape`: a Sheet's cell being edited, its Find bar, its copied range's marquee).
export function escapeRestores(
  e: Pick<KeyboardEvent, 'key' | 'defaultPrevented'> & { target?: EventTarget | null },
): boolean {
  const keeps = e.target instanceof Element && !!e.target.closest('[data-keeps-escape]');
  return (
    e.key === 'Escape' &&
    !e.defaultPrevented &&
    !keeps &&
    !document.querySelector(`[aria-modal="true"],[${MENU_SURFACE_ATTR}]`)
  );
}

// While `id` is maximised: Escape restores it (even with something selected), and the element going (unmounted: a tab switch, a deletion)
// or leaving Plan mode (`interactive` false) lets it go.
export function useMaximisedPlanLifetime(
  id: string,
  maximised: boolean,
  interactive: boolean,
): void {
  useEffect(() => {
    if (maximised && !interactive) releasePlanElement(id);
  }, [id, maximised, interactive]);
  useEffect(() => () => releasePlanElement(id), [id]);
  useEffect(() => {
    if (!maximised) return;
    // Capture phase, before the editor's own Escape (which deselects, and would leave this Escape prevented):
    // one Escape restores, and goes no further.
    const onKey = (e: KeyboardEvent) => {
      if (!escapeRestores(e)) return;
      e.preventDefault();
      e.stopPropagation();
      restorePlanElement();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [maximised]);
}

// What a slot's host is laid out as: filling whatever holds it (the canvas slot, or the overlay's box).
export function openBox(box: HTMLElement, id: string, host: HTMLElement): () => void {
  const origin = originOf(id);
  box.style.opacity = '';
  const reveal = () => {
    if (host.parentElement !== box) {
      box.appendChild(host);
      // Moved under the band: its name looks again (menu-name-slot).
      announceHeaderBand();
    }
  };
  const settle = () => box.classList.remove(...GHOST_CLASSES);
  if (!origin || prefersReducedMotion()) {
    box.style.transition = 'none';
    box.style.transform = 'none';
    reveal();
    settle();
    return () => {};
  }
  box.classList.add(...GHOST_CLASSES);
  // Measured untransformed, whatever a phase before left on it (a restore cut short, a re-run).
  box.style.transition = 'none';
  box.style.transform = 'none';
  box.style.transform = flipTransform(origin, box.getBoundingClientRect());
  void box.offsetWidth;
  box.style.transition = `transform ${MOTION_MS.long}ms cubic-bezier(0.16, 1, 0.3, 1)`;
  box.style.transform = 'none';
  let revealed = false;
  const show = () => {
    if (revealed) return;
    revealed = true;
    reveal();
    host.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: REVEAL_MS, easing: 'ease-out' });
  };
  const end = () => {
    show();
    settle();
  };
  const fade = window.setTimeout(show, MOTION_MS.long - REVEAL_MS);
  // The transition's end, or a timer should it never fire (a hidden tab).
  const done = window.setTimeout(end, MOTION_MS.long + 60);
  const onEnd = (e: TransitionEvent) => {
    if (e.target === box && e.propertyName === 'transform') end();
  };
  box.addEventListener('transitionend', onEnd);
  return () => {
    window.clearTimeout(fade);
    window.clearTimeout(done);
    box.removeEventListener('transitionend', onEnd);
  };
}

// Restoring (a container transform): the host goes straight back to its slot on the canvas, sharp in its own
// place, while an empty frame shrinks from the screen into that place and fades; then the restore finishes (at
// once without motion). Returns the cancel (maximising again while it shrinks back).
export function closeBox(box: HTMLElement, id: string, host: HTMLElement): () => void {
  const slot = document.querySelector(`[data-plan-slot="${CSS.escape(id)}"]`);
  if (slot && host.parentElement !== slot) {
    slot.appendChild(host);
    announceHeaderBand();
  }
  const origin = originOf(id);
  if (!origin || prefersReducedMotion()) {
    finishRestore();
    return () => {};
  }
  box.classList.add(...GHOST_CLASSES);
  box.style.transition = 'none';
  box.style.transform = 'none';
  box.style.opacity = '1';
  const target = box.getBoundingClientRect();
  void box.offsetWidth;
  box.style.transition = `transform ${MOTION_MS.long}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${MOTION_MS.long}ms ease-in`;
  box.style.transform = flipTransform(origin, target);
  box.style.opacity = '0';
  const done = window.setTimeout(finishRestore, MOTION_MS.long + 60);
  const onEnd = (e: TransitionEvent) => {
    if (e.target === box && e.propertyName === 'transform') finishRestore();
  };
  box.addEventListener('transitionend', onEnd);
  return () => {
    window.clearTimeout(done);
    box.removeEventListener('transitionend', onEnd);
  };
}

// The overlay a maximised element's host moves into: the canvas area (CANVAS_LAYER_Z), grown from the element's place
// on open and shrunk back to it on restore. The editor's chrome (header, tab bar, footer, palette, panels) stays.
