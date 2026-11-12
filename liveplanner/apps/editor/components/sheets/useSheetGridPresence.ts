// The grid's presence (docs/specs/029-sheets/sheet.md "Collaboration"; blueprint sheet-element.md "Presence"): this
// person's selection said to the room, and the outlines drawn over the cells (a formula's references, each peer's
// selection, Find's matches). A hook of SheetGrid.tsx's, called where its effects and memo stood.
import { useEffect, useMemo } from 'react';
import { posRangeOf } from '@liveplanner/sheets';
import type { SheetPeer } from '@/hooks/sheets/useSheetsBridge';
import { refSpans, spanRange } from './formula-assist';
import type { SheetController } from './sheet-controller';
import type { GridWindow } from './sheet-geometry';
import type { SheetPresence } from './sheet-presence-store';
import type { Outline } from './SheetSelectionLayer';

// Find's matches: a soft yellow, as a spreadsheet marks them.
const FIND_HIGHLIGHT = '#facc15';

export function useSheetGridPresence(
  c: SheetController,
  presence: SheetPresence,
  // When the presence store moved (its useSyncExternalStore version).
  presenceVersion: number,
  peers: readonly SheetPeer[],
  pointerHover: { r: number; c: number } | null,
  window: GridWindow,
): Outline[] {
  // This person's selection, said to the room (useSheetPresence's store throttles it).
  useEffect(() => {
    const ranges = c.selection.ranges
      .map((g) => {
        const rows = c.sheet.layout.rows;
        const cols = c.sheet.layout.cols;
        return rows[g.r1] && cols[g.c1] && rows[g.r2] && cols[g.c2]
          ? { r1: rows[g.r1]!, c1: cols[g.c1]!, r2: rows[g.r2]!, c2: cols[g.c2]! }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    presence.say({
      kind: 'sheet-presence',
      tabId: c.sheet.tabId,
      sheetId: c.sheet.id,
      ranges,
      editing: !!c.editing,
    });
  }, [c.selection, c.editing, c.sheet, presence]);
  useEffect(
    () => () =>
      presence.say({
        kind: 'sheet-presence',
        tabId: c.sheet.tabId,
        sheetId: c.sheet.id,
        ranges: null,
        editing: false,
      }),
    [presence, c.sheet.id, c.sheet.tabId],
  );

  return useMemo<Outline[]>(() => {
    const out: Outline[] = [];
    // The references a formula being written names, in their colours.
    if (c.editing?.draft.startsWith('=')) {
      for (const span of refSpans(c.editing.draft)) {
        const r = spanRange(span);
        if (r) out.push({ range: r, color: span.colour, dashed: true });
      }
    }
    // Each peer's selection, in their colour, named.
    const byId = new Map(peers.map((p) => [p.id, p]));
    for (const [id, sel] of presence.on(c.sheet.id, c.sheet.tabId)) {
      const peer = byId.get(id);
      if (!peer) continue;
      sel.ranges.forEach((ids, i) => {
        const p = posRangeOf(c.sheet.layout, ids);
        if (!p) return;
        const hover =
          !!pointerHover &&
          sel.ranges.some((ids) => {
            const g = posRangeOf(c.sheet.layout, ids);
            return (
              !!g &&
              pointerHover.r >= g.r1 &&
              pointerHover.r <= g.r2 &&
              pointerHover.c >= g.c1 &&
              pointerHover.c <= g.c2
            );
          });
        out.push({
          range: p,
          color: peer.color,
          thick: sel.editing,
          ...(i === 0 ? { label: peer.name, labelAt: sel.at, labelHover: hover } : {}),
        });
      });
    }
    // Find's matches in view.
    for (const h of c.findHits)
      if (h.r >= window.r1 && h.r <= window.r2 && h.c >= window.c1 && h.c <= window.c2)
        out.push({
          range: { r1: h.r, c1: h.c, r2: h.r, c2: h.c },
          color: FIND_HIGHLIGHT,
          highlight: true,
        });
    return out;
    // oxlint-disable-next-line react/exhaustive-deps -- `presence` is the store itself (stable); `presenceVersion` says when it moved
  }, [
    c.editing?.draft,
    peers,
    c.sheet.id,
    c.sheet.layout,
    presenceVersion,
    c.findHits,
    window,
    pointerHover,
  ]);
}
