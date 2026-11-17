'use client';

// Hide From Recording (liveworkspace/docs/specs/006-media/walkthroughs.md "Hide From Recording"): the elements a
// walkthrough's viewers won't see. Picked one press at a time in a crosshair mode, or the whole selection at once.
// The presenter sees them faded and dashed while setting up and recording; the events never name them.

import { WALKTHROUGH_HIDDEN_MAX } from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withAttachedArrows } from './attached';
import { applyHidden, elementIdAt, onHideableSurface } from './bridge';

const PICKING_ATTR = 'data-walkthrough-picking';
const PICKING_CSS = `[${PICKING_ATTR}],[${PICKING_ATTR}] *{cursor:crosshair !important}`;

export type HiddenState = ReturnType<typeof useHidden>;

const NO_MARKS: readonly string[] = [];

// `marks` are the host's hideable marks beside the canvas's elements, and `canHide` whether the tab showing has
// anything to hide: on one that has nothing the mode is left, as the dock no longer offers it.
export function useHidden(
  canvasRoot: () => HTMLElement | null,
  showing: boolean,
  marks: readonly string[] = NO_MARKS,
  canHide = true,
  elements?: () => readonly unknown[],
  // While the tab is filmed: hidden for real (the viewer's look), not faded, so the video never holds them.
  filming = false,
) {
  // What was picked; `hidden` adds the arrows attached to it, which go with it (withAttachedArrows).
  const [picks, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const hidden = useMemo(
    () => (elements ? withAttachedArrows(elements(), picks) : picks),
    [elements, picks],
  );
  const [picked, setPicking] = useState(false);
  const picking = picked && canHide;
  useEffect(() => {
    if (!canHide) setPicking(false);
  }, [canHide]);

  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      // A press on an arrow hidden with its element shows nothing new: it goes when its element is shown.
      if (next.has(id)) next.delete(id);
      else if (next.size < WALKTHROUGH_HIDDEN_MAX) next.add(id);
      return next;
    });
  }, []);

  const hideAll = useCallback((ids: readonly string[]) => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const id of ids) if (next.size < WALKTHROUGH_HIDDEN_MAX) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHidden(new Set());
    setPicking(false);
  }, []);

  // The presenter's look, while the recorder is open; gone outright while the tab is filmed.
  useEffect(() => {
    if (!showing) return;
    return applyHidden(document, hidden, filming ? 'viewer' : 'presenter', marks);
  }, [showing, hidden, marks, filming]);

  // Picking: a press on an element hides or shows it, and goes no further (the editor neither selects nor drags).
  const active = showing && picking;
  useEffect(() => {
    if (!active) return;
    const root = canvasRoot();
    if (!root) return;
    const style = document.createElement('style');
    style.textContent = PICKING_CSS;
    document.head.append(style);
    root.setAttribute(PICKING_ATTR, '');
    // Only presses on the canvas content or a marked thing: the walkthroughs' own cards may sit inside the same root.
    const onCanvas = (e: Event) => onHideableSurface(e.target, marks);
    const swallow = (e: Event) => {
      if (!onCanvas(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (!onCanvas(e)) return;
      swallow(e);
      const id = elementIdAt(e.target, marks);
      if (id) toggle(id);
    };
    root.addEventListener('pointerdown', onDown, { capture: true });
    root.addEventListener('click', swallow, { capture: true });
    root.addEventListener('dblclick', swallow, { capture: true });
    return () => {
      style.remove();
      root.removeAttribute(PICKING_ATTR);
      root.removeEventListener('pointerdown', onDown, { capture: true });
      root.removeEventListener('click', swallow, { capture: true });
      root.removeEventListener('dblclick', swallow, { capture: true });
    };
  }, [active, canvasRoot, toggle, marks]);

  // Esc leaves the mode, as Done does, and goes no further: the editor doesn't also clear its selection, and Tools, where
  // the set-up now sits, doesn't also step back out of it.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPicking(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [active]);

  return { hidden, picking, setPicking, toggle, hideAll, clear, canHide };
}
