import { useEffect, useRef, type RefObject } from 'react';
import { useLatest } from './useLatest';

// How long after a menu mounts a touch press outside it is ignored. A long press opens the menu
// under a finger that is still down, and its lift can land a trailing press outside the menu.
export const MENU_DISMISS_TOUCH_GRACE_MS = 400;

// Surfaces a menu opens that live outside its DOM (portalled to <body>) but count as the menu's own:
// a flyout panel, a confirm popover, the tour popover pointing at it, the button that toggles it.
export const MENU_DISMISS_INSIDE =
  '[data-menu-flyout],[data-confirm-popover],[data-tour-popover],[data-anchored-popover],[data-context-menu-trigger]';

// Close a floating menu the way every menu closes (docs/specs/008-canvas/canvas-and-palette.md, Tab
// menu "Closing"): a primary press outside it, a wheel scroll outside it, the window losing focus.
// Escape is the control-menu hook's job (useControlMenu).
//
// The press is heard on `pointerdown` in the CAPTURE phase: the canvas stops its own pointer events
// (and cancels the mousedown a touch would send), so a bubbling listener never heard a click on the
// canvas and the menu stayed open. Scrolling is the wheel rather than the `scroll` event: the tab
// strip scrolls itself to reveal a tab just right-clicked, which must not close the menu it opened.
//
// `ref` holds the menu box; while it is empty (a modal the menu swapped itself for owns dismissal)
// nothing closes. `anchor` is the control that opened it, whose own click toggles it.
export function useMenuDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  anchor?: Element | null,
): void {
  const close = useLatest(onClose);
  // Measured from mount, not from each effect run: a re-render must not renew the grace.
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = performance.now();
  }, []);

  useEffect(() => {
    const outside = (target: EventTarget | null) => {
      const node = ref.current;
      if (!node) return false;
      const t = target as Node | null;
      if (node.contains(t) || anchor?.contains(t)) return false;
      return !(t instanceof Element && t.closest(MENU_DISMISS_INSIDE));
    };
    const onPointer = (e: PointerEvent) => {
      // A right press is the start of a menu gesture whose release re-opens this menu where it lands.
      if (e.button === 2) return;
      if (
        e.pointerType === 'touch' &&
        performance.now() - openedAt.current < MENU_DISMISS_TOUCH_GRACE_MS
      )
        return;
      if (outside(e.target)) close.current();
    };
    const onWheel = (e: WheelEvent) => {
      if (outside(e.target)) close.current();
    };
    const onBlur = () => {
      if (ref.current) close.current();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [ref, anchor, close]);
}
