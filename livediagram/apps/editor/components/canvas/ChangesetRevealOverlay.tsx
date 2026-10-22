'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import { CHANGESET_REVEAL_MS } from '@livediagram/api-schema';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  elementBounds,
  type Element,
} from '@livediagram/document';
import { useCanvasSurface } from './CanvasSurfaceContext';
import type { ChangesetReveal, RevealStore } from '@/lib/changeset-reveals';

// The outline an agent's changeset draws around what it touched, in its author's colour
// (docs/specs/024-agents/blueprints/agent-changesets.md "Presentation and UX", "Accessibility"):
// 2 px, 4 px outside each element, over a 1 px halo in the canvas surface colour so it reads against
// any fill (WCAG 1.4.11). Canvas space, above the elements and below the selection chrome. It fades
// in and out over CHANGESET_REVEAL_MS; under reduced motion it appears and goes with no animation.
// Supplementary to the toast, so hidden from assistive technology.

export const ChangesetRevealContext = createContext<RevealStore | null>(null);

const OUTSET = 4;
const NONE: readonly ChangesetReveal[] = [];
const noStore = { subscribe: () => () => {}, getSnapshot: () => NONE };

export function ChangesetRevealOverlay({
  elements,
  tabId,
}: {
  elements: Element[];
  tabId: string;
}) {
  const store = useContext(ChangesetRevealContext) ?? noStore;
  const reveals = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const halo =
    useCanvasSurface() === 'dark' ? DARK_CANVAS_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR;
  const onTab = reveals.filter((r) => r.tabId === tabId);
  if (onTab.length === 0) return null;
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" data-changeset-reveal>
      {onTab.flatMap((reveal) =>
        reveal.ids.flatMap((id) => {
          const el = byId.get(id);
          // An element the changeset removed has nothing left to outline.
          if (!el) return [];
          const box = elementBounds(el, elements);
          return [
            <div
              key={`${reveal.changesetId}:${id}`}
              data-reveal-id={id}
              className="changeset-reveal absolute rounded-md"
              style={{
                left: box.x - OUTSET,
                top: box.y - OUTSET,
                width: box.width + OUTSET * 2,
                height: box.height + OUTSET * 2,
                border: `2px solid ${reveal.color}`,
                boxShadow: `0 0 0 1px ${halo}, inset 0 0 0 1px ${halo}`,
                animationDuration: `${CHANGESET_REVEAL_MS}ms`,
              }}
            />,
          ];
        }),
      )}
    </div>
  );
}
