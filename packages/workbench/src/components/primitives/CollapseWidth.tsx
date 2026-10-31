'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

// A box that eases its width open to its content's or shut to nothing, so what follows it slides along rather than
// jumping (a tab folder's tabs opening in place, docs/specs/006-document/tab-folders.md "Tab bar rendering"). Only
// its width and opacity move. Shut, it is `inert` (no focus, no clicks, hidden from assistive technology); settled
// open, it clips nothing, so a card's shadow inside it shows. Under reduced motion it snaps.
export const COLLAPSE_WIDTH_MS = 180;

// The width runs as a Web Animation with both ends given, not a CSS transition on `width`: Chrome dropped the
// transition shut (the box jumped to nothing) whenever React committed `inert` and the class in the same frame.
const EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';

export function CollapseWidth({
  open,
  children,
  ms = COLLAPSE_WIDTH_MS,
  center = false,
}: {
  open: boolean;
  children: ReactNode;
  // How long the width takes (the fade stays 180 ms); a tab's slots use the sliding card's, so the width lands with it.
  ms?: number;
  // Centre the content on the box's height (a tab's menu button) instead of standing it on the bottom edge.
  center?: boolean;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Width is written straight to the element: a React style would put it back on every render mid-animation.
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const settle = () => {
      box.style.width = open ? '' : '0px';
      box.style.overflow = open ? '' : 'hidden';
    };
    const still =
      !mounted.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    mounted.current = true;
    // From where it stands now (mid-way, if it was turned round) to where it is going; one layout read each way.
    const from = box.getBoundingClientRect().width;
    const to = open ? content.getBoundingClientRect().width : 0;
    if (still || typeof box.animate !== 'function' || from === to) {
      settle();
      return;
    }
    box.style.overflow = 'hidden';
    box.style.width = `${to}px`;
    const run = box.animate([{ width: `${from}px` }, { width: `${to}px` }], {
      duration: ms,
      easing: EASE_OUT,
    });
    run.onfinish = settle;
    return () => {
      run.onfinish = null;
      // Turned round mid-way: hold the width it reached, so the next run starts from there.
      box.style.width = getComputedStyle(box).width;
      run.cancel();
    };
  }, [open, ms]);

  return (
    <div
      ref={outer}
      inert={!open}
      data-collapse-width={open ? 'open' : 'shut'}
      className={`flex shrink-0 items-end self-stretch transition-opacity duration-[180ms] ease-out motion-reduce:transition-none ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={inner}
        className={`flex w-max shrink-0 self-stretch ${center ? 'items-center' : 'items-end'}`}
      >
        {children}
      </div>
    </div>
  );
}
