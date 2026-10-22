'use client';

import { useEffect, useEffectEvent, useLayoutEffect, type RefObject } from 'react';
import { focusablesOf, openedFromKeyboard } from '@liveplanner/ui';

// The button a shown dock popover hangs from: one popover is open at a time, and its button says so.
const OPEN_TRIGGER =
  '[data-dock-button][aria-expanded="true"], [data-dock-button] [aria-expanded="true"]';

// The keyboard in a dock popover (Layers, Find a Card, Card Types, ...; docs/specs/007-editor/panel-docking.md
// "Scope"). Its button pressed from the keyboard, focus moves to its first control (unless the popover placed it
// itself, Find a Card's field), as a control menu's does: it renders far from its button in the tab order, so Tab from the button
// never reached it. Escape closes it while focus is in it or on its button, and focus goes back to the button;
// Escape anywhere else keeps its own meaning and leaves the popover open. Taken in the capture phase, ahead of the
// editor's Escape (deselect), and marked handled. A panel opened inside the popover (a confirm, a row's menu) takes
// its own Escape first. Only a popover hung from a dock button: one opened from elsewhere keeps its own keys.
export function useDockPopoverKeys(
  panel: RefObject<HTMLElement | null>,
  shown: boolean,
  onClose: (() => void) | undefined,
): void {
  const close = useEffectEvent(() => onClose?.());
  const closes = !!onClose;
  useLayoutEffect(() => {
    const el = panel.current;
    if (!shown || !el || !openedFromKeyboard()) return;
    // Its button pressed from the keyboard: a shortcut pressed on the canvas leaves focus there.
    if (!document.querySelector(OPEN_TRIGGER)?.contains(document.activeElement)) return;
    focusablesOf(el)[0]?.focus({ preventScroll: true });
  }, [shown, panel]);
  useEffect(() => {
    if (!shown || !closes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const focus = document.activeElement;
      if (!(focus instanceof Node)) return;
      const trigger = document.querySelector<HTMLElement>(OPEN_TRIGGER);
      if (!trigger) return;
      const inPanel = !!panel.current?.contains(focus);
      if (!inPanel && !trigger.contains(focus)) return;
      e.preventDefault();
      if (inPanel) trigger.focus({ preventScroll: true });
      close();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [shown, closes, panel]);
}
