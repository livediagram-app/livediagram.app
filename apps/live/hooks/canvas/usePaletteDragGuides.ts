'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AlignmentGuide, DistributionGuide, Element } from '@livediagram/diagram';
import { pointerToCanvas } from '@/lib/canvas';
import { paletteDragSnapAt } from '@/lib/palette-drag-snap';
import {
  canInsertBetweenOn,
  findInsertionSlot,
  insertionGhostCentre,
  type InsertionGate,
  type InsertionSlot,
} from '@/lib/insert-between';
import {
  setInsertionSlot,
  setPaletteDragSnap,
  usePaletteDragPreview,
} from '@/lib/palette-drag-preview';

// Alignment guides DURING a palette drag (spec/139) — the single owner of the
// in-flight snap. It tracks the dragover cursor, converts it to canvas coords
// through the transformed wrapper (the same inversion the drop uses, so the
// ghost, the guides and the landed element can't disagree), runs the shared
// snap geometry, and publishes the offset for the ghost + drop to consume.
//
// On an event-storming board, WHILE ALT IS HELD, it also resolves the
// INSERTION SLOT the drag is offering (spec/139 insert between): the gap it
// would open, and which elements slide right to open it. That resolution is
// pure (lib/insert-between) and its result is published, never committed — the
// board only really moves on drop.
//
// Alt is read off each `dragover`, which is the ONLY channel available: during
// a native HTML5 drag Chromium delivers no key events to the document at all
// (the drag controller swallows them), so pressing or releasing Alt shows up
// on the next pointer movement rather than instantly. A stationary hand sees
// nothing change until it twitches — measured, not assumed.
//
// Why here rather than inside the ghost: the guides need the tab's elements
// and render in the canvas overlay, the ghost is a fixed-position DOM node,
// and the drop happens in a third place — one owner keeps the three honest.
// Stable empties, and set through a functional update, so "no guides" never
// counts as a change: the effect re-runs whenever its inputs' identities move
// (a caller minting a fresh Set per render is enough), and a fresh [] each
// time would re-render, re-run, re-clear — forever.
const NO_GUIDES: AlignmentGuide[] = [];
const NO_DIST_GUIDES: DistributionGuide[] = [];
const emptied = <T>(current: T[]): T[] => current;

export function usePaletteDragGuides({
  elements,
  viewportZoom,
  wrapperRef,
  insertGate,
  inertIds,
}: {
  elements: Element[];
  viewportZoom: number;
  wrapperRef: RefObject<HTMLElement | null>;
  // Insert between (spec/139): what the board and session allow. The other
  // half of the gate — the held Alt — is read off each dragover, so an
  // ordinary drag never offers a slot and a preview is never offered for a
  // drop that would be refused.
  insertGate: InsertionGate;
  // Elements on a hidden or locked layer: they cannot define the row, but
  // they still travel with the ripple.
  inertIds: ReadonlySet<string>;
}): { guides: AlignmentGuide[]; distGuides: DistributionGuide[] } {
  const preview = usePaletteDragPreview();
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [distGuides, setDistGuides] = useState<DistributionGuide[]>([]);
  // The board, read at EVENT time rather than captured per render. Keeping it
  // out of the effect's deps means publishing a guide can't tear down the
  // listener that published it (a caller minting a fresh Set or element array
  // per render would otherwise resubscribe on every state change, wiping the
  // in-flight slot's hysteresis with it) — and a peer's mid-drag edit is still
  // seen, because the handler reads the ref.
  const board = useRef({ elements, inertIds, insertGate });
  useEffect(() => {
    board.current = { elements, inertIds, insertGate };
  });

  useEffect(() => {
    const clearGuides = () => {
      setGuides((g) => (g.length === 0 ? emptied(g) : NO_GUIDES));
      setDistGuides((g) => (g.length === 0 ? emptied(g) : NO_DIST_GUIDES));
    };
    if (!preview) {
      clearGuides();
      setPaletteDragSnap(null);
      setInsertionSlot(null);
      return;
    }
    // The slot currently on offer, fed back into the resolver so it sticks
    // through a shaky hand (hysteresis). Scoped to this drag: a new drag
    // starts the effect again and can't inherit it.
    let slot: InsertionSlot | null = null;
    const clear = () => {
      slot = null;
      clearGuides();
      setPaletteDragSnap(null);
      setInsertionSlot(null);
    };
    const onDragOver = (e: DragEvent) => {
      const target = e.target as Element2 | null;
      // A drag back over a floating panel is a "changed my mind": no snap,
      // no guides — matching the ghost's own over-panel guard.
      const overPanel = !!target?.closest?.('[data-floating-panel]');
      const overCanvas = !!target?.closest?.('main');
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect || overPanel || !overCanvas) {
        clear();
        return;
      }
      const { x, y } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
      const { elements: live, inertIds: inert, insertGate: gate } = board.current;
      // Alt, live: press it mid-drag and the slot opens on the next move,
      // release it and the ordinary alignment snap takes back over.
      slot = canInsertBetweenOn(gate, e.altKey)
        ? findInsertionSlot({
            cursorX: x,
            cursorY: y,
            incomingWidth: preview.width,
            elements: live,
            inertIds: inert,
            active: slot,
          })
        : null;
      if (slot) {
        // The slot IS the placement while it is open, so the alignment snap
        // yields: two placement rules fighting would put the ghost, the
        // marker and the drop in three different places. The offset carries
        // the note to the slot's centre through the same channel the
        // alignment snap uses, so the ghost and the drop follow for free.
        const centre = insertionGhostCentre(slot, preview.width);
        setPaletteDragSnap({ dx: centre.x - x, dy: centre.y - y });
        setInsertionSlot(slot);
        // The marker: one vertical line where the board splits, in the guide
        // overlay's own visual language rather than a second vocabulary.
        setGuides([{ axis: 'x', position: slot.atX, start: slot.spanTop, end: slot.spanBottom }]);
        setDistGuides((g) => (g.length === 0 ? emptied(g) : NO_DIST_GUIDES));
        return;
      }
      setInsertionSlot(null);
      const snap = paletteDragSnapAt({
        canvasX: x,
        canvasY: y,
        width: preview.width,
        height: preview.height,
        elements: live,
      });
      setPaletteDragSnap({ dx: snap.dx, dy: snap.dy });
      setGuides(snap.guides);
      setDistGuides(snap.distGuides);
    };
    // Leaving the WINDOW (no relatedTarget) would otherwise strand the last
    // preview: dragover stops firing, so the board would sit open until the
    // cursor came back.
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) clear();
    };
    // Escape cancels the drag in most engines (which fires dragend, and the
    // tile clears the preview) — but not in all, and the board must never be
    // left holding a slot the user has abandoned.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('keydown', onKeyDown);
      clearGuides();
      setPaletteDragSnap(null);
      setInsertionSlot(null);
    };
  }, [preview, viewportZoom, wrapperRef]);

  return { guides, distGuides };
}

// The DOM Element type, aliased so the diagram package's `Element` (the
// domain model) can keep the unqualified name in this file.
type Element2 = globalThis.Element;
