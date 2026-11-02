'use client';

import { useLayoutEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

// The tab strip's keyboard, as a toolbar (docs/specs/006-document/tab-folders.md "Tab bar rendering"): one Tab stop,
// the open tab's name (its own `tabIndex`, TabFrame), and the arrow keys through every control in the strip in order:
// each tab's name, its avatars, the open tab's menu button, each folder chip. The apps' avatar and menu buttons are
// theirs, so the strip takes them out of the Tab order itself, as they arrive (avatars come and go with presence).

// A control the arrows reach. Tucked-away folder members sit under `inert` and are skipped.
const CONTROL = 'button:not([disabled])';
// The keys that own their own tabIndex: a tab's name (the open one is the Tab stop) and a folder chip.
const KEY = '[data-tab-key]';

const controls = (list: HTMLElement) =>
  Array.from(list.querySelectorAll<HTMLElement>(CONTROL)).filter((el) => !el.closest('[inert]'));

// Every control in the strip but a key leaves the Tab order; the arrows still reach it.
function quiet(list: HTMLElement) {
  for (const el of list.querySelectorAll<HTMLElement>(CONTROL))
    if (!el.matches(KEY) && el.tabIndex !== -1) el.tabIndex = -1;
}

export function useStripRoving(listRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    quiet(list);
    // Only nodes arriving or leaving, never attributes or text, so the sliding card and renames cost nothing here.
    const observer = new MutationObserver(() => quiet(list));
    observer.observe(list, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [listRef]);

  // Left and Right move to the previous or next control, Home and End to the ends; Enter and Space are the buttons'
  // own. Keys from a menu portalled out of a tab (React bubbles them here) or from the rename field are left alone.
  return (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const from = e.target as HTMLElement;
    if (!e.currentTarget.contains(from) || !from.matches(CONTROL)) return;
    const items = controls(e.currentTarget);
    const i = items.indexOf(from);
    if (i < 0) return;
    const last = items.length - 1;
    const to =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? last
          : e.key === 'ArrowLeft'
            ? Math.max(0, i - 1)
            : Math.min(last, i + 1);
    e.preventDefault();
    items[to]?.focus();
  };
}
