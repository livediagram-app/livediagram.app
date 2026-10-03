import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// The WAI-ARIA tree keyboard model over every `treeitem` inside one container
// (docs/specs/013-workspace/explorer-structure.md#keyboard-and-aria). DOM-driven, so it holds
// however the rows are composed: collapsed children are not rendered, which
// makes "every treeitem in document order" exactly the visible rows.
//
// A row marks its parts with data attributes: `data-tree-row` (the row's own
// line, as opposed to its child group), inside it `data-tree-toggle` (clicked
// to expand or collapse) and `data-tree-activate` (clicked to activate), and
// `data-tree-label` on the treeitem (matched by typeahead).

const ITEM = '[role="treeitem"]';

function itemsOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(ITEM)];
}

// The row's own control, never one belonging to a nested child row.
function ownPart(item: HTMLElement, part: 'toggle' | 'activate'): HTMLElement | null {
  return item.querySelector<HTMLElement>(`:scope > [data-tree-row] [data-tree-${part}]`);
}

export function useTreeNavigation(ref: RefObject<HTMLElement | null>) {
  // The row focus last sat on while inside; null once focus has left.
  const focusedRef = useRef<HTMLElement | null>(null);

  // Exactly one tabbable row: the focused one while inside, else the
  // current view's row, else the first.
  const syncTabStop = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const items = itemsOf(root);
    const focused = focusedRef.current;
    const stop =
      (focused && items.includes(focused) ? focused : null) ??
      items.find((i) => i.getAttribute('aria-selected') === 'true') ??
      items[0];
    for (const i of items) i.tabIndex = i === stop ? 0 : -1;
  }, [ref]);

  // After every render of the host, and whenever rows change underneath it.
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
    (e: React.FocusEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (!target.matches(ITEM)) return;
      focusedRef.current = target;
      syncTabStop();
    },
    [syncTabStop],
  );

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && ref.current?.contains(next)) return;
      focusedRef.current = null;
      syncTabStop();
    },
    [ref, syncTabStop],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const root = ref.current;
      const item = e.target as HTMLElement;
      // Only keys pressed ON a row: a field or a control inside one keeps its own.
      if (!root || !item.matches(ITEM) || e.altKey || e.ctrlKey || e.metaKey) return;
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
          handled = e.key.length === 1 && e.key !== ' ' && typeahead(items, index, e.key);
      }
      if (handled) e.preventDefault();
    },
    [ref],
  );

  return { onKeyDown, onFocus, onBlur };
}

// Focus the next row (wrapping) whose label starts with `char`; true when one did.
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
