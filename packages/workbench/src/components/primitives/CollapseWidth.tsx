'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

// A box that eases its width open to its content's or shut to nothing, so what follows it slides along rather than
// jumping (a tab folder's tabs opening in place, docs/specs/006-document/tab-folders.md "Tab bar rendering"). Only
// its width and opacity move. Shut, it is `inert` (no focus, no clicks, hidden from assistive technology); settled
// open, it clips nothing, so a card's shadow inside it shows. Under reduced motion it snaps.
export const COLLAPSE_WIDTH_MS = 180;

export function CollapseWidth({ open, children }: { open: boolean; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Width is written straight to the element: a React style would put it back on every render mid-transition.
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
    if (still) {
      settle();
      return;
    }
    // From where it stands now to where it is going; one layout read each way.
    const from = box.getBoundingClientRect().width;
    const to = open ? content.getBoundingClientRect().width : 0;
    box.style.overflow = 'hidden';
    box.style.width = `${from}px`;
    void box.offsetWidth;
    box.style.width = `${to}px`;
    const done = (e: TransitionEvent) => {
      if (e.target !== box || e.propertyName !== 'width') return;
      settle();
    };
    box.addEventListener('transitionend', done);
    // A transition the browser skips (a hidden tab, a zero distance) never ends: settle anyway.
    const timer = window.setTimeout(settle, COLLAPSE_WIDTH_MS + 80);
    return () => {
      box.removeEventListener('transitionend', done);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <div
      ref={outer}
      inert={!open}
      data-collapse-width={open ? 'open' : 'shut'}
      className={`flex shrink-0 items-end self-stretch transition-[width,opacity] duration-[180ms] ease-out motion-reduce:transition-none ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div ref={inner} className="flex w-max shrink-0 items-end self-stretch">
        {children}
      </div>
    </div>
  );
}
