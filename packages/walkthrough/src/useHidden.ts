'use client';

// Hide From Recording (liveworkspace/docs/specs/006-media/walkthroughs.md "Hide From Recording"): the elements a
// walkthrough's viewers won't see. Picked one press at a time in a crosshair mode, or the whole selection at once.
// The presenter sees them faded and dashed while setting up and recording; the events never name them.

import { WALKTHROUGH_HIDDEN_MAX } from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useState } from 'react';
import { applyHidden, CONTENT_SELECTOR, elementIdAt } from './bridge';

const PICKING_ATTR = 'data-walkthrough-picking';
const PICKING_CSS = `[${PICKING_ATTR}],[${PICKING_ATTR}] *{cursor:crosshair !important}`;

export type HiddenState = ReturnType<typeof useHidden>;

export function useHidden(canvasRoot: () => HTMLElement | null, showing: boolean) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [picking, setPicking] = useState(false);

  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
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

  // The presenter's look, while the recorder is open.
  useEffect(() => {
    if (!showing) return;
    return applyHidden(document, hidden, 'presenter');
  }, [showing, hidden]);

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
    // Only presses on the canvas content: the walkthroughs' own cards may sit inside the same root.
    const onCanvas = (e: Event) =>
      e.target instanceof Element && e.target.closest(CONTENT_SELECTOR) !== null;
    const swallow = (e: Event) => {
      if (!onCanvas(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (!onCanvas(e)) return;
      swallow(e);
      const id = elementIdAt(e.target);
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
  }, [active, canvasRoot, toggle]);

  return { hidden, picking, setPicking, toggle, hideAll, clear };
}
