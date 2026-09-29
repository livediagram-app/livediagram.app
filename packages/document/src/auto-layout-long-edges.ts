// Long edges in the layered flow layout (docs/specs/008-canvas/layout-cleanup.md "Long edges keep a
// lane"). An edge that skips ranks has no node in the ranks it passes, so
// nothing stops a real node sitting right on its line: a branch that rejoins
// two ranks down ran straight through the node between. Standard layered
// layout splits such an edge into a chain of virtual nodes, one per rank it
// crosses, so the chain takes part in ordering and placement like any node
// and reserves a lane; the virtual nodes are dropped once placed.
//
// Only forward edges are split. A back edge (a cycle) points up the ranks and
// is drawn as it lands.

import type { ElementId } from './index';
import type { Edge } from './auto-layout-shared';

// Cross-axis room a lane takes in its rank. Narrower than any real box, wide
// enough that a node beside it clears the line.
export const LANE_WIDTH = 32;

export type SplitGraph = {
  ids: ElementId[];
  edges: Edge[];
  layer: Map<ElementId, number>;
  lanes: Set<ElementId>;
};

export function splitLongEdges(
  ids: ElementId[],
  edges: Edge[],
  layer: Map<ElementId, number>,
): SplitGraph {
  const idset = new Set(ids);
  const outIds = [...ids];
  const outEdges: Edge[] = [];
  const outLayer = new Map(layer);
  const lanes = new Set<ElementId>();
  edges.forEach((e, i) => {
    if (!idset.has(e.from) || !idset.has(e.to)) return;
    const a = layer.get(e.from)!;
    const b = layer.get(e.to)!;
    if (b - a <= 1) {
      outEdges.push(e);
      return;
    }
    let prev = e.from;
    for (let r = a + 1; r < b; r++) {
      const lane = `\u0000lane-${i}-${r}`;
      lanes.add(lane);
      outIds.push(lane);
      outLayer.set(lane, r);
      outEdges.push({ from: prev, to: lane });
      prev = lane;
    }
    outEdges.push({ from: prev, to: e.to });
  });
  return { ids: outIds, edges: outEdges, layer: outLayer, lanes };
}
