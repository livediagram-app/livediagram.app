'use client';

// The name rides in the menu box (docs/specs/026-plan/plan-board.md "The name rides in the menu box"): while a
// maximised or tab-filling board, view or Sheet holds the top row in its header band, its title moves out of its header
// into the Toolbar layout's menu box, after the mode menu. The title is portalled, not copied, so it is the same
// component with the same state: a double-click on it still reaches its header's rename (React events follow the
// component tree through a portal). The slot is a module store, like maximised-plan.ts.
//
// Whether a header is in a band is read off the page: maximising moves the element's own DOM into the cover
// (MaximisedPlanLayer, FilledTabLayer) rather than rendering it there, so no React context reaches it. The cover says
// when its band comes or goes (`announceHeaderBand`), and each name checks for `[data-header-band]` above it then.
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

// The menu box's slot mounting (an element) or going (null).
export function setMenuNameSlot(el: HTMLElement | null): void {
  if (el === slot) return;
  slot = el;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSlot = () => slot;
const noSlot = () => null;
export function useMenuNameSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, getSlot, noSlot);
}

// The cover's band came or went (CanvasCover): every name looks again for a band above it.
let bandEpoch = 0;
const bandListeners = new Set<() => void>();
export function announceHeaderBand(): void {
  bandEpoch++;
  for (const l of bandListeners) l();
}
function subscribeBand(listener: () => void): () => void {
  bandListeners.add(listener);
  return () => bandListeners.delete(listener);
}
const getEpoch = () => bandEpoch;

// The selector CanvasCover marks its element's box with while it has a band.
export const HEADER_BAND_SELECTOR = '[data-header-band]';

// The slot in the menu box: a hairline before it, the chrome's own ink, hidden while it holds nothing. Its width is
// left out of the room the band needs (canvas-layer-insets MENU_NAME_SLOT_SELECTOR).
export function MenuNameSlot() {
  return (
    <span
      ref={setMenuNameSlot}
      data-menu-name-slot=""
      className="ml-0.5 flex min-w-0 max-w-[16rem] items-center gap-1.5 border-l border-slate-200 pl-2.5 pr-2 text-slate-800 empty:hidden dark:border-slate-700 dark:text-slate-100"
    />
  );
}

// The element's name: in the menu box while its header holds the top row (and the box is there), in place otherwise.
// `render` is told which, so the name can take the box's size and ink.
export function InMenuBox({ render }: { render: (inBox: boolean) => ReactNode }) {
  const target = useMenuNameSlot();
  const epoch = useSyncExternalStore(subscribeBand, getEpoch, getEpoch);
  // A marker that stays in the header, so the check reads where the header is, whichever way the name went.
  const marker = useRef<HTMLSpanElement>(null);
  const [inBand, setInBand] = useState(false);
  useLayoutEffect(() => {
    setInBand(!!marker.current?.closest(HEADER_BAND_SELECTOR));
  }, [epoch, target]);
  const inBox = inBand && !!target;
  return (
    <>
      <span ref={marker} hidden />
      {inBox ? createPortal(render(true), target) : render(false)}
    </>
  );
}

// The name's look in the box: the chrome's text, a little smaller than a header's, truncating.
export const IN_BOX_TITLE_CLASS = 'min-w-0 truncate text-[14px] font-semibold leading-tight';
