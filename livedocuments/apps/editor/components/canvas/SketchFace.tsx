'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { watchUntilSettled } from '@liveworkspace/workbench/components/canvas/settle-watch';

// A face drawn by hand under Sketch (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too"). The
// face renders once, live, with its ink hidden (app/sketch-face.css); underneath it sits a still copy of that DOM,
// its words hidden, drawn through the face wobble (SKETCH_FACE_FILTER). The copy is ours, not React's, so a face is
// never rendered twice and its effects never run twice. It is re-taken once the live face has been still for a
// moment (settle-watch.ts). Photos, embeds and `data-sketch-skip` parts (a tab
// window's content) stay out of it.
//
// Both layers fill the element's box, as the wrapper does, so they line up exactly. Neither sets a z-index: the
// copy comes first, so the live face paints over it without a new stacking context for its controls.
//
// A copy carries the face's CSS animations with it, and a fresh copy would start them again from 0: an entrance
// was dragged back to its first frame by every re-take while the face kept changing. So each copy's animations are set to where the live face's are (syncInkAnimations), and a
// re-take lands on the same frame instead of restarting.

/** What the ink copy leaves out: photos and embeds are not drawings, and a skipped part keeps its own look. */
const SKETCH_INK_PRUNE = 'img, video, iframe, canvas, [data-sketch-skip]';

/** The ink copy of a live face: no ids (so the live face's references keep resolving to its own), no photos,
 *  embeds or skipped parts, nothing focusable. */
export function sketchInkCopy(live: Element): Element {
  return inkCopyOf(live).copy;
}

/** A running animation on the live face, and the copy's element that carries the same one. */
type InkAnimationPair = { live: Animation; copy: Element };

/** The ink copy plus each live animation paired with its element in the copy (see syncInkAnimations). */
export function inkCopyOf(live: Element): { copy: Element; animated: InkAnimationPair[] } {
  const copy = live.cloneNode(true) as Element;
  const animated = pairAnimatedElements(live, copy);
  copy.removeAttribute('data-sketch-words');
  for (const pruned of copy.querySelectorAll(SKETCH_INK_PRUNE)) pruned.remove();
  for (const named of copy.querySelectorAll('[id]')) named.removeAttribute('id');
  return { copy, animated: animated.filter((pair) => copy.contains(pair.copy)) };
}

// Each animation running on the live face, paired with its element in the copy, found by place in document order
// before anything is pruned (a clone keeps that order). A face with nothing animating, the usual case, costs one
// getAnimations call; jsdom has none, so it costs nothing there.
function pairAnimatedElements(live: Element, copy: Element): InkAnimationPair[] {
  if (typeof live.getAnimations !== 'function') return [];
  // CSS animations only: a transition is a change in flight, and a fresh clone never starts one.
  const running = live.getAnimations({ subtree: true }).filter((a) => 'animationName' in a);
  if (running.length === 0) return [];
  const place = new Map<Element, number>(
    [live, ...live.querySelectorAll('*')].map((el, i) => [el, i]),
  );
  const copyOrder = [copy, ...copy.querySelectorAll('*')];
  const pairs: InkAnimationPair[] = [];
  for (const animation of running) {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    if (!(target instanceof Element)) continue; // a pseudo-element's: its host's copy re-runs it
    const twin = copyOrder[place.get(target) ?? -1];
    if (twin) pairs.push({ live: animation, copy: twin });
  }
  return pairs;
}

/** Sets each copied animation to the live one's time, so the ink shows the frame the live face is on. */
function syncInkAnimations(pairs: readonly InkAnimationPair[]): void {
  for (const { live, copy } of pairs) {
    const name = animationName(live);
    const twin = copy.getAnimations().find((a) => animationName(a) === name);
    if (twin && live.currentTime !== null) twin.currentTime = live.currentTime;
  }
}

const animationName = (a: Animation) => ('animationName' in a ? String(a.animationName) : null);

export function SketchFace({ active, children }: { active: boolean; children: ReactNode }) {
  const inkRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ink = inkRef.current;
    const live = liveRef.current;
    if (!active || !ink || !live) return;
    const take = () => {
      const { copy, animated } = inkCopyOf(live);
      ink.replaceChildren(...copy.childNodes);
      syncInkAnimations(animated);
    };
    take();
    const stop = watchUntilSettled(live, take);
    return () => {
      stop();
      ink.replaceChildren();
    };
  }, [active]);

  if (!active) return <>{children}</>;
  return (
    <>
      <div ref={inkRef} data-sketch-ink="" aria-hidden inert className="absolute inset-0" />
      <div ref={liveRef} data-sketch-words="" className="absolute inset-0">
        {children}
      </div>
    </>
  );
}
