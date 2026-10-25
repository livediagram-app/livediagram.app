// The DOM reads the menu hooks share (docs/specs/004-interface-design/menus.md): a menu's own
// items, a control menu's focusables, the tabbable beside a trigger, and who owns focus.

import { accessibleNameOf } from '../hint/trigger-text';
import { lastInputWasKeyboard } from './input-modality';
import {
  FOCUSABLE_SELECTOR,
  MENU_ITEM_SELECTOR,
  MENU_PARENT_ATTR,
  MENU_SURFACE_ATTR,
} from './menu-constants';

const SURFACE = `[${MENU_SURFACE_ATTR}]`;
const MENU = '[role="menu"]';

const isLive = (el: Element): boolean => el.closest('[inert],[hidden]') === null;

/** The items this menu owns, in order: not a nested menu's, not inside a collapsed section. */
export function menuItemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
    (el) => el.parentElement?.closest(MENU) === menu && isLive(el),
  );
}

/** What typeahead matches against: the item's accessible name. */
export function itemLabel(item: Element): string {
  return accessibleNameOf(item);
}

/** A control menu's enabled controls, in reading order, outside collapsed sections. */
export function focusablesOf(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isLive(el) && el.getAttribute('tabindex') !== '-1',
  );
}

// Laid out and painted. Without layout (jsdom) everything counts as visible.
const isRendered = (el: HTMLElement): boolean =>
  typeof el.checkVisibility === 'function' && el.getClientRects().length > 0
    ? el.checkVisibility({ visibilityProperty: true })
    : true;

/**
 * The tabbable control after (or before) `from` in document order, outside `exclude` (the closing
 * menu); null at the end of the page. Where Tab goes when it closes a menu (D53).
 */
export function tabbableNeighbour(
  from: HTMLElement,
  backwards: boolean,
  exclude?: HTMLElement | null,
): HTMLElement | null {
  const all = Array.from(
    from.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      el !== from &&
      el.tabIndex >= 0 &&
      el.getAttribute('tabindex') !== '-1' &&
      !el.matches(MENU_ITEM_SELECTOR) &&
      !(exclude?.contains(el) ?? false) &&
      isLive(el) &&
      isRendered(el),
  );
  const after = (el: HTMLElement) =>
    (from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  if (backwards) return all.filter((el) => !after(el)).pop() ?? null;
  return all.find(after) ?? null;
}

/**
 * Whether focus is in this surface, or in a submenu or sub-panel whose parent chain leads back to
 * it (the flyouts are portalled, so they are not its DOM descendants).
 */
export function ownsFocus(
  surface: HTMLElement,
  active: Element | null = document.activeElement,
): boolean {
  let at = active instanceof Element ? active.closest(SURFACE) : null;
  while (at) {
    if (at === surface) return true;
    const parent = at.getAttribute(MENU_PARENT_ATTR);
    at = parent ? surface.ownerDocument.getElementById(parent) : null;
  }
  return false;
}

/** Whether an event target sits inside a menu of either kind: the canvas's shortcuts stand down. */
export function isInMenuSurface(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(SURFACE) !== null;
}

// Controls Space presses or ticks for itself (WAI-ARIA): the canvas's Space never takes these.
const PRESSABLE =
  'button, a[href], select, summary, input, textarea, [contenteditable=""], [contenteditable="true"], [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="slider"]';

/** Whether Space on this target belongs to a control (WAI-ARIA: it presses a button, ticks a box): a
 *  canvas's Space shortcut (pan, a tap into a label edit) stands down for it. Only a control focused from
 *  the keyboard (`:focus-visible`) counts, so a toolbar button that keeps focus after a mouse click does
 *  not swallow Space-to-pan. */
export function isPressableControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(PRESSABLE);
  if (!control) return false;
  try {
    return control.matches(':focus-visible');
  } catch {
    return true;
  }
}

const TEXT_INPUT = /^(text|search|email|url|tel|password|number)$/;

/** A text field or editable region holds focus: opening a menu never takes it away. */
export function isTextEditFocused(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLInputElement) return TEXT_INPUT.test(active.type);
  // `isContentEditable` needs layout-aware engines; the attribute answers everywhere.
  return (
    active instanceof HTMLElement &&
    (active.isContentEditable === true ||
      active.closest(
        '[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]',
      ) !== null)
  );
}

/**
 * Whether the keyboard opened what is opening now: the last interaction was a key press, not a
 * pointer press (D51). Tracked on the document, because the control that opened a menu may be gone
 * by the time the menu mounts.
 */
export function openedFromKeyboard(): boolean {
  return lastInputWasKeyboard();
}
