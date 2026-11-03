// Writes each riding element's offset to the page (docs/specs/008-canvas/drag-preview.md "Moves ride an offset"):
// a CSS `translate` on every node tagged with its id (`data-ride-id`: the element's own root, its arrow <svg>, its
// grips in the grips layer), outside React, so a move frame renders no element view. `translate` composes with the
// element's own `transform` (rotation, the insert-between shift, isometric depth) instead of replacing it.
// React never sets `translate`, so it never overwrites or clears the offset.

import type { RideOffset } from './drag-ride';

export const RIDE_ATTRIBUTE = 'data-ride-id';

export type RideWriter = {
  // Where the tagged nodes are: the element plane's parent, which also holds the grips layer.
  setRoot: (root: ParentNode | null) => void;
  // Shifts every node of each id in `rides`, and puts back any node shifted before whose id is no longer there.
  apply: (rides: ReadonlyMap<string, RideOffset>) => void;
  // Whether any node is shifted now.
  active: () => boolean;
};

type Styled = {
  style: { translate: string };
  isConnected: boolean;
  getAttribute(n: string): string | null;
};

const offsetCss = (o: RideOffset) => `${o.dx}px ${o.dy}px`;

export function createRideWriter(): RideWriter {
  let root: ParentNode | null = null;
  // The nodes of each id, found once per set of riding ids: a query of the page per gesture, not per frame.
  let nodes = new Map<string, Styled[]>();
  let nodesFor: ReadonlySet<string> = new Set();
  // What each shifted id carries now, so a frame writes only what changed.
  let written = new Map<string, string>();

  const sameIds = (rides: ReadonlyMap<string, RideOffset>) =>
    rides.size === nodesFor.size && [...rides.keys()].every((id) => nodesFor.has(id));

  function find(rides: ReadonlyMap<string, RideOffset>): void {
    nodes = new Map();
    nodesFor = new Set(rides.keys());
    if (!root) return;
    for (const node of root.querySelectorAll(`[${RIDE_ATTRIBUTE}]`) as Iterable<Styled>) {
      const id = node.getAttribute(RIDE_ATTRIBUTE)!;
      if (!rides.has(id)) continue;
      const list = nodes.get(id);
      if (list) list.push(node);
      else nodes.set(id, [node]);
    }
  }

  const write = (id: string, css: string) => {
    for (const node of nodes.get(id) ?? []) node.style.translate = css;
  };

  return {
    setRoot(next) {
      root = next;
      nodesFor = new Set();
    },
    apply(rides) {
      if (rides.size === 0 && written.size === 0) return;
      // Put back what no longer rides, while its nodes are still the ones found.
      for (const id of written.keys()) if (!rides.has(id)) write(id, '');
      const stale =
        !sameIds(rides) || [...nodes.values()].some((list) => list.some((n) => !n.isConnected));
      const next = new Map<string, string>();
      if (stale) {
        find(rides);
        for (const [id, o] of rides) {
          const css = offsetCss(o);
          write(id, css);
          next.set(id, css);
        }
      } else {
        for (const [id, o] of rides) {
          const css = offsetCss(o);
          if (written.get(id) !== css) write(id, css);
          next.set(id, css);
        }
      }
      written = next;
      if (rides.size === 0) {
        nodes = new Map();
        nodesFor = new Set();
      }
    },
    active: () => written.size > 0,
  };
}
