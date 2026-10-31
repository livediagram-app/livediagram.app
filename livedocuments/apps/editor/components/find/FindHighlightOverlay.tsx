'use client';

// The Find bar's matches on the elements (docs/specs/007-editor/find-and-replace.md "Highlights"; blueprint
// "Highlights"): a ring round each element holding a match, dashed find yellow, solid orange round the one holding
// the match in hand, slate round one this person may not replace, each over a 1 px halo in the canvas colour so it
// reads on any page (as an agent's focus ring does). Canvas space, above the elements. Only the marked elements are
// drawn, and only this layer re-renders as the matches change. Hidden from assistive technology: the bar's count
// speaks.
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  elementBounds,
  type Element,
} from '@livedocuments/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useFindElementMarks, type FindMark } from '@/lib/find/find-highlight-store';

// Clear of the element's own selection ring.
const OUTSET = 4;

const RING: Record<FindMark, string> = {
  match: '2px dashed #facc15',
  current: '2px solid #f97316',
  held: '2px dashed #94a3b8',
};

export function FindHighlightOverlay({ elements }: { elements: Element[] }) {
  const marks = useFindElementMarks();
  const halo =
    useCanvasSurface() === 'dark' ? DARK_CANVAS_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR;
  if (marks.size === 0) return null;
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" data-find-highlights="">
      {[...marks].map(([id, mark]) => {
        const el = byId.get(id);
        if (!el) return null;
        const box = elementBounds(el, elements);
        return (
          <div
            key={id}
            data-find-ring={mark}
            data-find-element={id}
            className="absolute rounded-md"
            style={{
              left: box.x - OUTSET,
              top: box.y - OUTSET,
              width: box.width + OUTSET * 2,
              height: box.height + OUTSET * 2,
              border: RING[mark],
              boxShadow: `0 0 0 1px ${halo}, inset 0 0 0 1px ${halo}`,
            }}
          />
        );
      })}
    </div>
  );
}
