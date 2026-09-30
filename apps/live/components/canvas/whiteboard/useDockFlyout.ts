'use client';

// The dock's one open flyout (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): which
// it is, where it sits, whether the pointer opened it, and the delayed close of a hover-opened one.
// Only one flyout is open at a time, whichever group its opener is in.

import { useState } from 'react';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { SlotSource } from '@/lib/whiteboard-shape-slots';
import { useHoverClose } from './useHoverClose';

export type DockFlyoutKind = WhiteboardPenId | 'eraser' | 'settings' | 'shapes' | 'search' | 'slot';

// The flyouts whose openers live in the Shapes group: they close when that group goes (Simple mode).
export const SHAPES_GROUP_FLYOUTS: readonly DockFlyoutKind[] = ['shapes', 'search', 'slot'];

export type DockFlyout = {
  kind: DockFlyoutKind;
  // Opened by the pointer resting on its button: closes again when it leaves.
  hover: boolean;
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
    extra: { hover?: boolean; slot?: SlotSource } = {},
  ) =>
    setFlyout({
      kind,
      hover: extra.hover ?? false,
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

  const close = (returnFocus = false) => {
    const key = flyout?.openerKey;
    setFlyout(null);
    if (returnFocus && key) {
      document
        .querySelector<HTMLElement>(`[data-whiteboard-dock] [data-dock-item="${key}"]`)
        ?.focus();
    }
  };

  return { flyout, open, toggle, hoverEnter, hoverLeave, cancelHoverClose, close };
}

export type DockFlyoutApi = ReturnType<typeof useDockFlyout>;
