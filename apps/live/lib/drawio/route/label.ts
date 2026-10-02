// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// Where draw.io centres an edge's label (blueprint step 12.13): mxGraphView.updateEdgeLabelOffset
// for the edge's own label, and mxGraphView.updateCellState's relative child geometry
// (mxGraphView.getPoint) for a label child, in draw.io units.

import type { DrawioGeometry } from '../cells';
import type { Pt } from './geometry';
import { pointAlong, type CellState } from './state';

/** mxGraphView.updateEdgeLabelOffset: the centre of the edge's own label. */
export function edgeLabelPoint(state: CellState, geometry: DrawioGeometry | undefined): Pt {
  const pts = state.absolutePoints!;
  if (!geometry || geometry.relative) {
    return pointAlong(state, geometry?.x ?? 0, geometry?.y ?? 0, geometry?.offset);
  }
  const p0 = pts[0]!;
  const pe = pts[pts.length - 1]!;
  return {
    x: p0.x + (pe.x - p0.x) / 2 + (geometry.offset?.x ?? 0),
    y: p0.y + (pe.y - p0.y) / 2 + (geometry.offset?.y ?? 0),
  };
}

/** mxGraphView.updateCellState for a vertex inside an edge: its box's corner at the point along the
 *  edge (relative) or in the edge's parent's coordinates (absolute); the label's centre is the
 *  box's centre. */
export function childLabelPoint(state: CellState, geometry: DrawioGeometry, origin: Pt): Pt {
  const corner = geometry.relative
    ? pointAlong(state, geometry.x, geometry.y, geometry.offset)
    : { x: origin.x + geometry.x, y: origin.y + geometry.y };
  return { x: corner.x + geometry.width / 2, y: corner.y + geometry.height / 2 };
}
