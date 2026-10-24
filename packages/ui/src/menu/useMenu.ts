'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { accessibleNameOf } from '../hint/trigger-text';
import { lastFocusedElement } from './input-modality';
import {
  MENU_FOCUS_RETRY_FRAMES,
  MENU_LABEL_ATTR,
  MENU_PARENT_ATTR,
  MENU_SURFACE_ATTR,
} from './menu-constants';
import {
  isTextEditFocused,
  itemLabel,
  menuItemsOf,
  ownsFocus,
  tabbableNeighbour,
} from './menu-dom';
import {
  initialIndex,
  menuKeyIntent,
  moveIndex,
  typeaheadIndex,
  typeaheadQuery,
  type MenuInitialFocus,
  type TypeaheadState,
} from './menu-keys';
import { MenuTreeContext, type MenuKind, type MenuTree } from './menu-tree';

// A command menu (docs/specs/004-interface-design/menus.md "Command menus"; blueprint M1 to M10):
// the one place menu roles, labelling, focus on open, the keyboard and focus return are written.
// The host spreads `surfaceProps` and `ref` on its menu element and provides `tree` to its rows.

export type UseMenuOptions = {
  /** Close this menu (only this one: a submenu closes itself, not its parent). */
  onClose: () => void;
  /** For a menu that stays mounted while closed; default true. */
  open?: boolean;
  /** The control that opened it: it names the menu, gets `aria-controls`, and takes focus back. */
  trigger?: HTMLElement | null;
  initialFocus?: MenuInitialFocus;
  /** A name of its own, when neither a header nor the trigger says it. */
  label?: string;
};

export type SurfaceProps<Role extends 'menu' | 'dialog'> = {
  id: string;
  role: Role;
  tabIndex: -1;
  'aria-label'?: string;
  'data-menu-surface': MenuKind;
  'data-menu-parent'?: string;
};

export type MenuHandle<Role extends 'menu' | 'dialog'> = {
  /** Callback ref for the menu element; hooks act when the element appears, not on mount. */
  attach: (el: HTMLElement | null) => void;
  element: HTMLElement | null;
  /** Provide to the menu's rows: `<MenuTreeContext.Provider value={tree}>`. */
  tree: MenuTree;
  surfaceProps: SurfaceProps<Role>;
};

const SURFACE = `[${MENU_SURFACE_ATTR}]`;

/** The element ref, held in state too so effects run when a late-positioned menu appears. */
export function useSurfaceElement() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    elementRef.current = el;
    setElement(el);
  }, []);
  return { element, elementRef, ref };
}

/**
 * Where focus goes when a menu closes holding it: where it was at open, else the trigger (M10).
 * When both are gone (the control re-renders as the menu closes, as the selection toolbar's More
 * actions does), the next frame looks the place up again by its id.
 */
export function returnFocus(target: HTMLElement | null, trigger: HTMLElement | null): void {
  const to = target?.isConnected ? target : trigger?.isConnected ? trigger : null;
  if (to) {
    to.focus({ preventScroll: true });
    return;
  }
  const id = target?.id || trigger?.id;
  if (!id || typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    document.getElementById(id)?.focus({ preventScroll: true });
  });
}

/**
 * M10 from inside a commit. Focus moves at once, so a dialog or rename field that a verb opens in
 * the same commit still takes it after; then, once the commit is done, it moves again if focus
 * ended up back in the menu or nowhere: React restores focus to the element that held it before a
 * commit when that element is still mounted (a menu that stays mounted while closed, such as the
 * product switcher), which would otherwise leave focus inside a hidden menu.
 */
export function returnFocusAfterCommit(
  surface: HTMLElement,
  target: HTMLElement | null,
  trigger: HTMLElement | null,
): void {
  returnFocus(target, trigger);
  queueMicrotask(() => {
    const active = surface.ownerDocument.activeElement;
    if (active && active !== surface.ownerDocument.body && !surface.contains(active)) return;
    returnFocus(target, trigger);
  });
}

/**
 * What held focus as the menu opened, if anything did. Focus on the body means the control that
 * held it may have gone away as the menu opened; the last focused element stands in for it then.
 */
export function focusedOutside(surface: HTMLElement): HTMLElement | null {
  const doc = surface.ownerDocument;
  const active = doc.activeElement;
  if (active instanceof HTMLElement && active !== doc.body) {
    return surface.contains(active) ? null : active;
  }
  // Only a control that is GONE stands in: a live one that lost focus earlier is somewhere else.
  const held = lastFocusedElement();
  if (!held || held.isConnected) return null;
  return surface.contains(held) ? null : held;
}

export function useMenu({
  onClose,
  open = true,
  trigger = null,
  initialFocus = 'checked',
  label,
}: UseMenuOptions): MenuHandle<'menu'> {
  const id = useId();
  const parent = useContext(MenuTreeContext);
  const inSubmenu = parent?.kind === 'command';
  const { element, elementRef, ref } = useSurfaceElement();
  const returnTarget = useRef<HTMLElement | null>(null);
  const typeahead = useRef<TypeaheadState>({ query: '', at: 0 });
  // The latest callbacks and options, read by listeners bound once per open element.
  const latest = useRef({ onClose, trigger, initialFocus, parent });
  useLayoutEffect(() => {
    latest.current = { onClose, trigger, initialFocus, parent };
  });

  // M9: Tab closes the whole tree. A submenu asks its parent; the root moves focus on and closes.
  const closeTree = useCallback(
    (backwards: boolean) => {
      const { parent: up, trigger: own, onClose: close } = latest.current;
      if (inSubmenu && up) {
        up.closeTree(backwards);
        return;
      }
      const from = returnTarget.current?.isConnected ? returnTarget.current : own;
      const next = from ? tabbableNeighbour(from, backwards, elementRef.current) : null;
      (next ?? from)?.focus();
      close();
    },
    [inSubmenu, elementRef],
  );
  const tree = useMemo<MenuTree>(() => ({ kind: 'command', id, closeTree }), [id, closeTree]);

  // M1 + M10: focus in on open, focus back on close.
  useLayoutEffect(() => {
    if (!element || !open) return;
    returnTarget.current = focusedOutside(element);
    typeahead.current = { query: '', at: 0 };
    let retry = 0;
    let closed = false;
    const items = menuItemsOf(element);
    if (items.length === 0) {
      console.warn('[menu] opened with no items', { id });
    } else if (latest.current.initialFocus !== 'none' && !isTextEditFocused()) {
      // Only a one-of-a-set entry draws focus to itself; checkboxes start at the top.
      const checked = items.map(
        (item) =>
          item.getAttribute('role') === 'menuitemradio' &&
          item.getAttribute('aria-checked') === 'true',
      );
      const first = items[initialIndex(checked, latest.current.initialFocus)];
      first?.focus({ preventScroll: true });
      // A menu that becomes visible through a transition (the product switcher fades in from
      // `visibility: hidden`) cannot take focus until the transition has started; keep trying for a
      // few frames, stopping the moment focus is anywhere in the menu or anywhere else at all.
      const from = element.ownerDocument.activeElement;
      let frames = MENU_FOCUS_RETRY_FRAMES;
      const settle = () => {
        const now = element.ownerDocument.activeElement;
        if (closed || !first?.isConnected || element.contains(now) || now !== from) return;
        if (frames-- <= 0 || isTextEditFocused()) return;
        first.focus({ preventScroll: true });
        retry = requestAnimationFrame(settle);
      };
      if (first && !element.contains(from)) retry = requestAnimationFrame(settle);
    }
    return () => {
      closed = true;
      cancelAnimationFrame(retry);
      if (ownsFocus(element))
        returnFocusAfterCommit(element, returnTarget.current, latest.current.trigger);
    };
  }, [element, open, id]);

  // M2: a header it owns names it, else its own label (a prop), else its trigger.
  useLayoutEffect(() => {
    if (!element || label !== undefined) return;
    const header = Array.from(element.querySelectorAll<HTMLElement>(`[${MENU_LABEL_ATTR}]`)).find(
      (h) => h.closest(SURFACE) === element,
    );
    const by = header?.id || (trigger?.id ?? '');
    if (by) {
      element.setAttribute('aria-labelledby', by);
      element.removeAttribute('aria-label');
    } else if (trigger) {
      element.removeAttribute('aria-labelledby');
      element.setAttribute('aria-label', accessibleNameOf(trigger));
    }
  });

  // M3: the trigger points at the open menu, unless it already manages aria-controls itself.
  useEffect(() => {
    if (!open || !trigger || !element || trigger.hasAttribute('aria-controls')) return;
    trigger.setAttribute('aria-controls', id);
    return () => {
      if (trigger.getAttribute('aria-controls') === id) trigger.removeAttribute('aria-controls');
    };
  }, [open, trigger, element, id]);

  // M4 to M9: the keyboard, on the menu element itself, so a portalled submenu's keys stay its own.
  useEffect(() => {
    if (!element || !open) return;
    let cancelSpaceUp = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const items = menuItemsOf(element);
      const active = element.ownerDocument.activeElement;
      const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
      const current = items[index];
      if (!current && active !== element) return;
      const intent = menuKeyIntent(e, {
        inSubmenu,
        onSubmenuTrigger: current?.getAttribute('aria-haspopup') === 'menu',
      });
      if (!intent) return;
      e.preventDefault();
      e.stopPropagation();
      const focusAt = (i: number) => items[i]?.focus({ preventScroll: true });
      const intoSubmenu = (item: HTMLElement) => {
        const subId = item.getAttribute('aria-controls');
        const sub = subId ? element.ownerDocument.getElementById(subId) : null;
        if (sub) menuItemsOf(sub)[0]?.focus({ preventScroll: true });
      };
      switch (intent.kind) {
        case 'move':
          focusAt(moveIndex(index, items.length, intent.to));
          return;
        case 'type': {
          typeahead.current = typeaheadQuery(typeahead.current, intent.char, performance.now());
          const found = typeaheadIndex(items.map(itemLabel), index, typeahead.current.query);
          if (found >= 0) focusAt(found);
          return;
        }
        case 'activate':
        case 'enter-submenu': {
          if (!current || current.getAttribute('aria-disabled') === 'true') return;
          if (
            current.getAttribute('aria-haspopup') === 'menu' &&
            current.getAttribute('aria-expanded') === 'true'
          ) {
            intoSubmenu(current);
            return;
          }
          if (intent.kind === 'activate' && e.key === ' ') cancelSpaceUp = true;
          current.click();
          return;
        }
        case 'leave-submenu':
        case 'close':
          latest.current.onClose();
          return;
        case 'tab':
          closeTree(intent.backwards);
          return;
      }
    };
    // A button clicks on Space's keyup; the keydown already activated it.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !cancelSpaceUp) return;
      cancelSpaceUp = false;
      e.preventDefault();
    };
    // M11: focus moving somewhere outside the menu (and outside its submenus) closes it. A blur to
    // nowhere is a press (Safari does not focus a pressed button) and leaves it open.
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (!(next instanceof Element) || ownsFocus(element, next)) return;
      latest.current.onClose();
    };
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', onKeyUp);
      element.removeEventListener('focusout', onFocusOut);
    };
  }, [element, open, inSubmenu, closeTree]);

  const surfaceProps: SurfaceProps<'menu'> = {
    id,
    role: 'menu',
    tabIndex: -1,
    [MENU_SURFACE_ATTR]: 'command',
    ...(parent ? { [MENU_PARENT_ATTR]: parent.id } : null),
    ...(label !== undefined ? { 'aria-label': label } : null),
  };
  return { attach: ref, element, tree, surfaceProps };
}
