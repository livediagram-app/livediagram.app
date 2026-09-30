'use client';

// The dock's one open flyout (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): which
// it is, where it sits, whether the pointer opened it, and the delayed close of a hover-opened one.
// Only one flyout is open at a time, whichever group its opener is in.

import { useState } from 'react';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { SlotSource } from '@/lib/whiteboard-shape-slots';
import { useHoverClose } from './useHoverClose';

export type DockFlyoutKind = WhiteboardPenId | 'eraser' | 'settings' | 'shapes' | 'slot';

export type DockFlyout = {
  kind: DockFlyoutKind;
  // Opened by the pointer resting on its button: closes again when it leaves.
  hover: boolean;
  // Opened by hover, even if it has since been made to stay: closing gives the focus back to the
  // board, not to the opener (the Shapes flyout's field takes the focus on a hover).
  viaHover: boolean;
  // Horizontal centre, in px from the dock wrapper's left edge; measured once, on opening.
  left: number;
  // The opener's data-dock-item, which gets the focus back on Escape.
  openerKey: string;
  // The slot a slot menu is about.
  slot?: SlotSource;
};

// How long a hover-opened flyout waits after the pointer leaves, so crossing the gap into it (or
// brushing past) never snaps it shut.
const HOVER_CLOSE_MS = 250;

function measure(opener: HTMLElement): number {
  const wrap = opener.closest('[data-whiteboard-dock]')?.getBoundingClientRect();
  const btn = opener.getBoundingClientRect();
  return wrap ? btn.left + btn.width / 2 - wrap.left : 0;
}

export function useDockFlyout() {
  const [flyout, setFlyout] = useState<DockFlyout | null>(null);
  const { schedule, cancel: cancelHoverClose } = useHoverClose(HOVER_CLOSE_MS);

  const open = (
    kind: DockFlyoutKind,
    opener: HTMLElement,
    // `viaKey`: opened by a key (S), which, like a hover, sends the focus back to the board on close.
    extra: { hover?: boolean; viaKey?: boolean; slot?: SlotSource } = {},
  ) =>
    setFlyout({
      kind,
      hover: extra.hover ?? false,
      viaHover: (extra.hover ?? false) || (extra.viaKey ?? false),
      left: measure(opener),
      openerKey: opener.dataset.dockItem ?? '',
      slot: extra.slot,
    });

  const toggle = (kind: DockFlyoutKind, opener: HTMLElement) => {
    cancelHoverClose();
    // A press on a flyout the pointer opened keeps it open (it stops being a hover flyout) rather
    // than closing what the pointer just showed.
    if (flyout?.kind === kind && flyout.hover) {
      setFlyout({ ...flyout, hover: false });
      return;
    }
    if (flyout?.kind === kind) {
      setFlyout(null);
      return;
    }
    open(kind, opener);
  };

  // Hover: opens while the pointer rests on the button (never for touch; the caller checks) and
  // closes a moment after it leaves both the button and the flyout.
  const hoverEnter = (kind: DockFlyoutKind, opener: HTMLElement) => {
    cancelHoverClose();
    if (flyout?.kind !== kind) open(kind, opener, { hover: true });
  };
  const hoverLeave = () => {
    if (!flyout?.hover) return;
    schedule(() => setFlyout((f) => (f?.hover ? null : f)));
  };

  // Keep a hover-opened flyout open once the user works in it (typing in the Shapes search).
  const stick = () => {
    cancelHoverClose();
    setFlyout((f) => (f?.hover ? { ...f, hover: false } : f));
  };

  const close = (returnFocus = false) => {
    const key = flyout?.openerKey;
    const toOpener = returnFocus && !flyout?.viaHover;
    setFlyout(null);
    if (toOpener && key) {
      document
        .querySelector<HTMLElement>(`[data-whiteboard-dock] [data-dock-item="${key}"]`)
        ?.focus();
    }
  };

  // Place the open flyout over its opener again, once the opener has moved (a mode switch removed
  // a group before it and the dock re-centred).
  const reanchor = () => {
    if (!flyout) return;
    const opener = document.querySelector<HTMLElement>(
      `[data-whiteboard-dock] [data-dock-item="${flyout.openerKey}"]`,
    );
    if (!opener) return;
    const left = measure(opener);
    if (left !== flyout.left) setFlyout({ ...flyout, left });
  };

  return { flyout, open, toggle, hoverEnter, hoverLeave, cancelHoverClose, close, stick, reanchor };
}

export type DockFlyoutApi = ReturnType<typeof useDockFlyout>;
