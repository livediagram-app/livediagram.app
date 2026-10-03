'use client';

import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { MENU_PARENT_ATTR, MENU_SURFACE_ATTR } from './menu-constants';
import { focusablesOf, isTextEditFocused, openedFromKeyboard, ownsFocus } from './menu-dom';
import { MenuTreeContext, type MenuTree } from './menu-tree';
import { focusedOutside, returnFocus, useSurfaceElement, type MenuHandle } from './useMenu';

// A control menu (docs/specs/004-interface-design/menus.md "Control menus"; blueprint C1 to C3):
// a menu holding controls, announced as a named non-modal dialog. Tab walks its controls; focus
// moves in only when the keyboard opened it; Escape closes the innermost open sub-panel first;
// focus comes back as a command menu's does.

export type UseControlMenuOptions = {
  onClose: () => void;
  /** What Escape does; default `onClose` (a menu with a confirm open closes the confirm first). */
  onEscape?: () => void;
  trigger?: HTMLElement | null;
  label: string;
  /** Default: whether the keyboard opened it (D51). */
  focusOnOpen?: boolean;
};

export function useControlMenu({
  onClose,
  onEscape,
  trigger = null,
  label,
  focusOnOpen,
}: UseControlMenuOptions): MenuHandle<'dialog'> {
  const id = useId();
  const parent = useContext(MenuTreeContext);
  const { element, ref } = useSurfaceElement();
  const returnTarget = useRef<HTMLElement | null>(null);
  const latest = useRef({ onClose, onEscape, trigger, focusOnOpen });
  useLayoutEffect(() => {
    latest.current = { onClose, onEscape, trigger, focusOnOpen };
  });

  const closeTree = useCallback(() => latest.current.onClose(), []);
  const tree = useMemo<MenuTree>(() => ({ kind: 'control', id, closeTree }), [id, closeTree]);

  // C1 + C3.
  useLayoutEffect(() => {
    if (!element) return;
    returnTarget.current = focusedOutside(element);
    const focus = latest.current.focusOnOpen ?? openedFromKeyboard();
    if (focus && !isTextEditFocused()) focusablesOf(element)[0]?.focus({ preventScroll: true });
    return () => {
      if (ownsFocus(element)) returnFocus(returnTarget.current, latest.current.trigger);
    };
  }, [element]);

  // C2: a sub-panel hears Escape on itself and claims it; the root hears it anywhere on the page
  // that nothing closer claimed (a field clearing itself, a confirm, a sub-panel).
  const isSub = parent !== null;
  useEffect(() => {
    if (!element) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      (latest.current.onEscape ?? latest.current.onClose)();
    };
    const target: HTMLElement | Document = isSub ? element : element.ownerDocument;
    target.addEventListener('keydown', onKeyDown as EventListener);
    return () => target.removeEventListener('keydown', onKeyDown as EventListener);
  }, [element, isSub]);

  return {
    attach: ref,
    element,
    tree,
    surfaceProps: {
      id,
      role: 'dialog',
      tabIndex: -1,
      'aria-label': label,
      [MENU_SURFACE_ATTR]: 'control',
      ...(parent ? { [MENU_PARENT_ATTR]: parent.id } : null),
    },
  };
}
