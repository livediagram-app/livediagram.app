'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import type { MenuInitialFocus } from './menu-keys';

// A menu's trigger (docs/specs/004-interface-design/menus.md; WAI-ARIA Menu Button): it says it
// opens a menu and whether that menu is open, opens on click, Enter or Space (the button's own
// click), and on Down Arrow at the first item or Up Arrow at the last. The menu itself (useMenu)
// moves focus in and gives it back.

export type MenuButton = {
  open: boolean;
  initialFocus: MenuInitialFocus;
  /** The trigger element, for the menu to anchor to and return focus to. */
  trigger: HTMLElement | null;
  openMenu: (focus?: MenuInitialFocus) => void;
  close: () => void;
  toggle: () => void;
  /** The arrow keys that open the menu; for a trigger that writes its own `onKeyDown`. */
  onTriggerKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  triggerProps: {
    ref: (el: HTMLElement | null) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  };
};

export function useMenuButton(): MenuButton {
  const [state, setState] = useState<{ open: boolean; initialFocus: MenuInitialFocus }>({
    open: false,
    initialFocus: 'checked',
  });
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const openMenu = useCallback(
    (initialFocus: MenuInitialFocus = 'checked') => setState({ open: true, initialFocus }),
    [],
  );
  const close = useCallback(() => setState((s) => (s.open ? { ...s, open: false } : s)), []);
  const toggle = useCallback(
    () => setState((s) => ({ open: !s.open, initialFocus: 'checked' })),
    [],
  );
  const { open } = state;
  const onTriggerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (open || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? 'checked' : 'last');
    },
    [open, openMenu],
  );
  return {
    open,
    initialFocus: state.initialFocus,
    trigger,
    openMenu,
    close,
    toggle,
    onTriggerKeyDown,
    triggerProps: {
      ref: setTrigger,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      onClick: toggle,
      onKeyDown: onTriggerKeyDown,
    },
  };
}
