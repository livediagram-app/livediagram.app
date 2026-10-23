'use client';

// The WAI-ARIA tree keyboard model over every `treeitem` in the sidebar (livediagram's useTreeNavigation;
// liveplanner/docs/specs/013-workspace/explorer-structure.md "Keyboard and ARIA"). DOM-driven, so it holds however the
// rows are composed: folded children are not rendered, which makes "every treeitem in document order" exactly the
// rows on screen.
//
// A row marks its parts with data attributes: `data-tree-row` (the row's own line, as opposed to its child group),
// inside it `data-tree-toggle` (clicked to open or fold) and `data-tree-activate` (clicked to go there), and
// `data-tree-label` on the treeitem (matched by type-ahead).
//
// - One tab stop: the row focus last sat on while inside, else the current view's row, else the first.
// - Up and Down move a row; Home and End go to the first and last.
// - Right opens a folded row, or moves into an open one; Left folds an open row, or moves to its parent.
// - Enter and Space go to the row's view. Shift+F10 and the Menu key open its menu, as a right-click does.
// - A printable character moves to the next row whose name starts with it, wrapping.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';

const ITEM = '[role="treeitem"]';

// Every row in document order. A tag walk rather than a selector: it stays cheap however big the tree (2,000 open
// folder rows), where an attribute selector is not in every engine.
function itemsOf(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const li of root.getElementsByTagName('li')) {
    if (li.getAttribute('role') === 'treeitem') out.push(li);
  }
  return out;
}

// The row's own control, never one belonging to a nested child row.
function ownPart(item: HTMLElement, part: 'toggle' | 'activate'): HTMLElement | null {
  return item.querySelector<HTMLElement>(`:scope > [data-tree-row] [data-tree-${part}]`);
}

export function useTreeNavigation(ref: RefObject<HTMLElement | null>) {
  // The row focus last sat on while inside; null once focus has left.
  const focusedRef = useRef<HTMLElement | null>(null);

  const syncTabStop = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const items = itemsOf(root);
    const focused = focusedRef.current;
    const stop =
      (focused && items.includes(focused) ? focused : null) ??
      items.find((i) => i.getAttribute('aria-selected') === 'true') ??
      items[0];
    for (const i of items) {
      const tabIndex = i === stop ? 0 : -1;
      if (i.tabIndex !== tabIndex) i.tabIndex = tabIndex;
    }
  }, [ref]);

  // After every render of the sidebar, and whenever rows change underneath it.
  useLayoutEffect(syncTabStop);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new MutationObserver(syncTabStop);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
    return () => observer.disconnect();
  }, [ref, syncTabStop]);

  const onFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      if (!e.target.matches(ITEM)) return;
      focusedRef.current = e.target;
      syncTabStop();
    },
    [syncTabStop],
  );

  const onBlur = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && ref.current?.contains(next)) return;
      focusedRef.current = null;
      syncTabStop();
    },
    [ref, syncTabStop],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const root = ref.current;
      const item = e.target as HTMLElement;
      // Only keys pressed ON a row: a field or a control inside one keeps its own.
      if (!root || !item.matches(ITEM) || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        e.preventDefault();
        const box = item.getBoundingClientRect();
        item.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: box.left,
            clientY: box.bottom,
          }),
        );
        return;
      }
      if (e.shiftKey && e.key !== 'Shift' && e.key.length !== 1) return;
      const items = itemsOf(root);
      const index = items.indexOf(item);
      const expanded = item.getAttribute('aria-expanded');
      const move = (to: HTMLElement | null | undefined) => to?.focus();
      let handled = true;
      switch (e.key) {
        case 'ArrowDown':
          move(items[index + 1]);
          break;
        case 'ArrowUp':
          move(items[index - 1]);
          break;
        case 'Home':
          move(items[0]);
          break;
        case 'End':
          move(items[items.length - 1]);
          break;
        case 'ArrowRight':
          if (expanded === 'false') ownPart(item, 'toggle')?.click();
          else if (expanded === 'true')
            move(item.querySelector<HTMLElement>(`:scope > [role="group"] ${ITEM}`));
          break;
        case 'ArrowLeft':
          if (expanded === 'true') ownPart(item, 'toggle')?.click();
          else move(item.parentElement?.closest<HTMLElement>(ITEM));
          break;
        case 'Enter':
        case ' ':
          ownPart(item, 'activate')?.click();
          break;
        default:
          handled = e.key.length === 1 && typeahead(items, index, e.key);
      }
      if (handled) e.preventDefault();
    },
    [ref],
  );

  return { onKeyDown, onFocus, onBlur };
}

// Focus the next row (wrapping) whose name starts with `char`; true when one did.
function typeahead(items: HTMLElement[], from: number, char: string): boolean {
  const wanted = char.toLowerCase();
  for (let step = 1; step <= items.length; step++) {
    const candidate = items[(from + step) % items.length];
    if (candidate?.dataset.treeLabel?.toLowerCase().startsWith(wanted)) {
      candidate.focus();
      return true;
    }
  }
  return false;
}
