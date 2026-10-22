'use client';

import { createContext, useContext } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  elementBounds,
  type Element,
} from '@livediagram/document';
import { useCanvasSurface } from './CanvasSurfaceContext';

// The focus rings of the agents present on the tab (docs/specs/024-agents/blueprints/agent-presence.md
// "Presentation and UX", "Accessibility"): a static 2 px outline in the owner's colour, 4 px outside the element,
// over a 1 px halo in the canvas surface colour so it reads against any fill (WCAG 1.4.11). Two people's agents on
// one element nest, each ring a step further out. Canvas space, beneath the remote cursors. Supplementary to the
// avatar's accessible name and the Collaborators row, so hidden from assistive technology.

export type AgentFocusByElement = ReadonlyMap<string, readonly { name: string; color: string }[]>;

export const AgentFocusContext = createContext<AgentFocusByElement>(new Map());

const OUTSET = 4;
// How much further out each further person's ring sits, so nested rings never touch.
const NEST_STEP = 4;

export function AgentFocusOverlay({ elements }: { elements: Element[] }) {
  const focus = useContext(AgentFocusContext);
  const halo =
    useCanvasSurface() === 'dark' ? DARK_CANVAS_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR;
  if (focus.size === 0) return null;
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" data-agent-focus>
      {[...focus].flatMap(([id, owners]) => {
        const el = byId.get(id);
        if (!el) return [];
        const box = elementBounds(el, elements);
        return owners.map((owner, index) => {
          const outset = OUTSET + index * NEST_STEP;
          return (
            <div
              key={`${id}:${index}`}
              data-agent-focus-id={id}
              className="absolute rounded-md"
              style={{
                left: box.x - outset,
                top: box.y - outset,
                width: box.width + outset * 2,
                height: box.height + outset * 2,
                border: `2px solid ${owner.color}`,
                boxShadow: `0 0 0 1px ${halo}, inset 0 0 0 1px ${halo}`,
              }}
            />
          );
        });
      })}
    </div>
  );
}
