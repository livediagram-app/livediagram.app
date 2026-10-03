// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// draw.io's orthogonal router (edgeStyle=orthogonalEdgeStyle), ported from jgraph/drawio v31.7.0
// (mxEdgeStyle.OrthConnector and getJettySize in mxgraph/src/view/mxEdgeStyle.js; Apache-2.0).
// It picks the sides each end leaves through from where the shapes sit (or from the side a fixed
// end lies on), then walks a route pattern for that pair of sides, keeping a jetty clear of each
// shape.

import {
  MASK_ALL,
  MASK_EAST,
  MASK_NORTH,
  MASK_SOUTH,
  MASK_WEST,
  reversePortConstraints,
  rotatedBounds,
} from './geometry';
import type { EdgeRouting, EdgeStyle } from './edge-styles';
import { terminalPortConstraints } from './edge-styles';
import { roundPoints, roundState, segmentConnector } from './segment-connector';
import { styleNumber, styleValue, type CellState } from './state';

const ORTH_BUFFER = 10;
const DIR_VECTORS = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
] as const;

// mxEdgeStyle.routePatterns: per (source side, target side) after turning by the quadrant.
const ROUTE_PATTERNS: readonly (readonly (readonly number[])[])[] = [
  [
    [513, 2308, 2081, 2562],
    [513, 1090, 514, 2184, 2114, 2561],
    [513, 1090, 514, 2564, 2184, 2562],
    [513, 2308, 2561, 1090, 514, 2568, 2308],
  ],
  [
    [514, 1057, 513, 2308, 2081, 2562],
    [514, 2184, 2114, 2561],
    [514, 2184, 2562, 1057, 513, 2564, 2184],
    [514, 1057, 513, 2568, 2308, 2561],
  ],
  [
    [1090, 514, 1057, 513, 2308, 2081, 2562],
    [2114, 2561],
    [1090, 2562, 1057, 513, 2564, 2184],
    [1090, 514, 1057, 513, 2308, 2561, 2568],
  ],
  [
    [2081, 2562],
    [1057, 513, 1090, 514, 2184, 2114, 2561],
    [1057, 513, 1090, 514, 2184, 2562, 2564],
    [1057, 2561, 1090, 514, 2568, 2308],
  ],
];

const SOURCE_MASK = 1024;
const TARGET_MASK = 2048;
const SIDE_MASK = 480;
const CENTER_MASK = 512;

/** mxEdgeStyle.getJettySize: how far an end runs straight out of its shape. */
export function jettySize(edge: EdgeRouting, isSource: boolean): number {
  const value =
    styleValue(edge.style, isSource ? 'sourceJettySize' : 'targetJettySize') ??
    styleValue(edge.style, 'jettySize') ??
    ORTH_BUFFER;
  if (value !== 'auto') return Number(value);
  const type = styleValue(edge.style, isSource ? 'startArrow' : 'endArrow');
  if (type !== undefined) {
    const size = styleNumber(edge.style, isSource ? 'startSize' : 'endSize', 6);
    return Math.max(2, Math.ceil((size + ORTH_BUFFER) / ORTH_BUFFER)) * ORTH_BUFFER;
  }
  return 2 * ORTH_BUFFER;
}

const rotationOf = (s: CellState) => styleNumber(s.style, 'rotation');

/** mxEdgeStyle.OrthConnector */
export const orthConnector: EdgeStyle = (
  edge,
  sourceScaled,
  targetScaled,
  controlHints,
  result,
) => {
  const pts = roundPoints(edge.absolutePoints);
  const source = roundState<CellState>(sourceScaled);
  const target = roundState<CellState>(targetScaled);
  const p0 = pts[0] ?? null;
  const pe = pts[pts.length - 1] ?? null;

  let sourceX = source ? source.x : p0!.x;
  let sourceY = source ? source.y : p0!.y;
  let sourceWidth = source ? source.width : 1;
  let sourceHeight = source ? source.height : 1;
  let targetX = target ? target.x : pe!.x;
  let targetY = target ? target.y : pe!.y;
  let targetWidth = target ? target.width : 1;
  let targetHeight = target ? target.height : 1;

  let sourceBuffer = jettySize(edge, true);
  let targetBuffer = jettySize(edge, false);
  // A loop routes within the larger buffer at both ends.
  if (source && targetScaled === sourceScaled) {
    targetBuffer = Math.max(sourceBuffer, targetBuffer);
    sourceBuffer = targetBuffer;
  }
  const totalBuffer = targetBuffer + sourceBuffer;
  let tooShort = false;
  if (p0 && pe) {
    const dx = pe.x - p0.x;
    const dy = pe.y - p0.y;
    tooShort = dx * dx + dy * dy < totalBuffer * totalBuffer;
  }
  if (tooShort || controlHints.length > 0) {
    segmentConnector(edge, sourceScaled, targetScaled, controlHints, result);
    return;
  }

  const portConstraint = [MASK_ALL, MASK_ALL];
  if (source) {
    portConstraint[0] = terminalPortConstraints(source, edge, true, MASK_ALL);
    const rotation = rotationOf(source);
    if (rotation !== 0) {
      const r = rotatedBounds(
        { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
        rotation,
      );
      ({ x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight } = r);
    }
  }
  if (target) {
    portConstraint[1] = terminalPortConstraints(target, edge, false, MASK_ALL);
    const rotation = rotationOf(target);
    if (rotation !== 0) {
      const r = rotatedBounds(
        { x: targetX, y: targetY, width: targetWidth, height: targetHeight },
        rotation,
      );
      ({ x: targetX, y: targetY, width: targetWidth, height: targetHeight } = r);
    }
  }
  if (sourceWidth === 0 || sourceHeight === 0 || targetWidth === 0 || targetHeight === 0) return;

  const dir = [0, 0];
  const geo = [
    [sourceX, sourceY, sourceWidth, sourceHeight],
    [targetX, targetY, targetWidth, targetHeight],
  ] as const;
  const buffer = [sourceBuffer, targetBuffer];
  const limits = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  for (let i = 0; i < 2; i++) {
    const g = geo[i]!;
    limits[i]![1] = g[0] - buffer[i]!;
    limits[i]![2] = g[1] - buffer[i]!;
    limits[i]![4] = g[0] + g[2] + buffer[i]!;
    limits[i]![8] = g[1] + g[3] + buffer[i]!;
  }

  // Which quadrant the target is in: 0 | 1 above, 3 | 2 below.
  const dx = geo[0][0] + geo[0][2] / 2 - (geo[1][0] + geo[1][2] / 2);
  const dy = geo[0][1] + geo[0][3] / 2 - (geo[1][1] + geo[1][3] / 2);
  let quad = 0;
  if (dx < 0) quad = dy < 0 ? 2 : 1;
  else if (dy <= 0) quad = dx === 0 ? 2 : 3;

  // A fixed end on a side leaves through that side.
  const constraint = [
    [0.5, 0.5],
    [0.5, 0.5],
  ];
  if (!source) constraint[0] = [0, 0];
  if (!target) constraint[1] = [0, 0];
  let currentTerm = source ? p0 : null;
  for (let i = 0; i < 2; i++) {
    if (currentTerm) {
      const g = geo[i]!;
      constraint[i]![0] = (currentTerm.x - g[0]) / g[2];
      if (Math.abs(currentTerm.x - g[0]) <= 1) dir[i] = MASK_WEST;
      else if (Math.abs(currentTerm.x - g[0] - g[2]) <= 1) dir[i] = MASK_EAST;
      constraint[i]![1] = (currentTerm.y - g[1]) / g[3];
      if (Math.abs(currentTerm.y - g[1]) <= 1) dir[i] = MASK_NORTH;
      else if (Math.abs(currentTerm.y - g[1] - g[3]) <= 1) dir[i] = MASK_SOUTH;
    }
    currentTerm = target ? pe : null;
  }

  const sourceTopDist = geo[0][1] - (geo[1][1] + geo[1][3]);
  const sourceLeftDist = geo[0][0] - (geo[1][0] + geo[1][2]);
  const sourceBottomDist = geo[1][1] - (geo[0][1] + geo[0][3]);
  const sourceRightDist = geo[1][0] - (geo[0][0] + geo[0][2]);
  const vertexSeparations: number[] = [];
  vertexSeparations[1] = Math.max(sourceLeftDist - totalBuffer, 0);
  vertexSeparations[2] = Math.max(sourceTopDist - totalBuffer, 0);
  vertexSeparations[4] = Math.max(sourceBottomDist - totalBuffer, 0);
  vertexSeparations[3] = Math.max(sourceRightDist - totalBuffer, 0);

  // The preferred sides, in order.
  const horPref: number[] = [];
  const vertPref: number[] = [];
  horPref[0] = sourceLeftDist >= sourceRightDist ? MASK_WEST : MASK_EAST;
  vertPref[0] = sourceTopDist >= sourceBottomDist ? MASK_NORTH : MASK_SOUTH;
  horPref[1] = reversePortConstraints(horPref[0]);
  vertPref[1] = reversePortConstraints(vertPref[0]);
  const preferredHorizDist = Math.max(sourceLeftDist, sourceRightDist);
  const preferredVertDist = Math.max(sourceTopDist, sourceBottomDist);
  const prefOrdering = [
    [0, 0],
    [0, 0],
  ];
  let preferredOrderSet = false;
  for (let i = 0; i < 2; i++) {
    if (dir[i] !== 0) continue;
    if ((horPref[i]! & portConstraint[i]!) === 0) horPref[i] = reversePortConstraints(horPref[i]!);
    if ((vertPref[i]! & portConstraint[i]!) === 0) {
      vertPref[i] = reversePortConstraints(vertPref[i]!);
    }
    prefOrdering[i] = [vertPref[i]!, horPref[i]!];
  }
  if (preferredVertDist > 0 && preferredHorizDist > 0) {
    if ((horPref[0]! & portConstraint[0]!) > 0 && (vertPref[1]! & portConstraint[1]!) > 0) {
      prefOrdering[0] = [horPref[0]!, vertPref[0]!];
      prefOrdering[1] = [vertPref[1]!, horPref[1]!];
      preferredOrderSet = true;
    } else if ((vertPref[0]! & portConstraint[0]!) > 0 && (horPref[1]! & portConstraint[1]!) > 0) {
      prefOrdering[0] = [vertPref[0]!, horPref[0]!];
      prefOrdering[1] = [horPref[1]!, vertPref[1]!];
      preferredOrderSet = true;
    }
  }
  if (preferredVertDist > 0 && !preferredOrderSet) {
    prefOrdering[0] = [vertPref[0]!, horPref[0]!];
    prefOrdering[1] = [vertPref[1]!, horPref[1]!];
    preferredOrderSet = true;
  }
  if (preferredHorizDist > 0 && !preferredOrderSet) {
    prefOrdering[0] = [horPref[0]!, vertPref[0]!];
    prefOrdering[1] = [horPref[1]!, vertPref[1]!];
  }

  // Compact the preference lists past any gaps.
  for (let i = 0; i < 2; i++) {
    if (dir[i] !== 0) continue;
    const pc = portConstraint[i]!;
    const own = prefOrdering[i]!;
    const other = prefOrdering[1 - i]!;
    if ((own[0]! & pc) === 0) own[0] = own[1]!;
    let pref = own[0]! & pc;
    pref |= (own[1]! & pc) << 8;
    pref |= (other[i]! & pc) << 16;
    pref |= (other[1 - i]! & pc) << 24;
    if ((pref & 0xf) === 0) pref = pref << 8;
    if ((pref & 0xf00) === 0) pref = (pref & 0xf) | (pref >> 8);
    if ((pref & 0xf0000) === 0) pref = (pref & 0xffff) | ((pref & 0xf000000) >> 8);
    dir[i] = pref & 0xf;
    if (pc === MASK_WEST || pc === MASK_NORTH || pc === MASK_EAST || pc === MASK_SOUTH) dir[i] = pc;
  }

  let sourceIndex = (dir[0] === MASK_EAST ? 3 : dir[0]!) - quad;
  let targetIndex = (dir[1] === MASK_EAST ? 3 : dir[1]!) - quad;
  if (sourceIndex < 1) sourceIndex += 4;
  if (targetIndex < 1) targetIndex += 4;
  const routePattern = ROUTE_PATTERNS[sourceIndex - 1]![targetIndex - 1]!;

  const wayPoints: number[][] = Array.from({ length: 12 }, () => [0, 0]);
  wayPoints[0] = [geo[0][0], geo[0][1]];
  const w0 = wayPoints[0];
  switch (dir[0]) {
    case MASK_WEST:
      w0[0]! -= sourceBuffer;
      w0[1]! += constraint[0]![1]! * geo[0][3];
      break;
    case MASK_SOUTH:
      w0[0]! += constraint[0]![0]! * geo[0][2];
      w0[1]! += geo[0][3] + sourceBuffer;
      break;
    case MASK_EAST:
      w0[0]! += geo[0][2] + sourceBuffer;
      w0[1]! += constraint[0]![1]! * geo[0][3];
      break;
    case MASK_NORTH:
      w0[0]! += constraint[0]![0]! * geo[0][2];
      w0[1]! -= sourceBuffer;
      break;
  }

  let currentIndex = 0;
  // Orientation: 0 horizontal, 1 vertical.
  let lastOrientation = (dir[0]! & (MASK_EAST | MASK_WEST)) > 0 ? 0 : 1;
  const initialOrientation = lastOrientation;

  for (const step of routePattern) {
    const nextDirection = step & 0xf;
    let directionIndex = nextDirection === MASK_EAST ? 3 : nextDirection;
    directionIndex += quad;
    if (directionIndex > 4) directionIndex -= 4;
    const direction = DIR_VECTORS[directionIndex - 1]!;
    const currentOrientation = directionIndex % 2 > 0 ? 0 : 1;
    // The same point moves until the segment turns.
    if (currentOrientation !== lastOrientation) {
      currentIndex++;
      wayPoints[currentIndex] = [...wayPoints[currentIndex - 1]!];
    }
    const wp = wayPoints[currentIndex]!;
    const tar = (step & TARGET_MASK) > 0;
    const sou = (step & SOURCE_MASK) > 0;
    let side = (step & SIDE_MASK) >> 5;
    side = side << quad;
    if (side > 0xf) side = side >> 4;
    const center = (step & CENTER_MASK) > 0;

    if ((sou || tar) && side < 9) {
      const souTar = sou ? 0 : 1;
      const g = geo[souTar]!;
      let limit: number;
      if (center && currentOrientation === 0) limit = g[0] + constraint[souTar]![0]! * g[2];
      else if (center) limit = g[1] + constraint[souTar]![1]! * g[3];
      else limit = limits[souTar]![side]!;
      if (currentOrientation === 0) {
        const deltaX = (limit - wp[0]!) * direction[0];
        if (deltaX > 0) wp[0]! += direction[0] * deltaX;
      } else {
        const deltaY = (limit - wp[1]!) * direction[1];
        if (deltaY > 0) wp[1]! += direction[1] * deltaY;
      }
    } else if (center) {
      // Towards the middle of the gap between the shapes.
      wp[0]! += direction[0] * Math.abs(vertexSeparations[directionIndex]! / 2);
      wp[1]! += direction[1] * Math.abs(vertexSeparations[directionIndex]! / 2);
    }

    if (
      currentIndex > 0 &&
      wp[currentOrientation] === wayPoints[currentIndex - 1]![currentOrientation]
    ) {
      currentIndex--;
    } else {
      lastOrientation = currentOrientation;
    }
  }

  for (let i = 0; i <= currentIndex; i++) {
    if (i === currentIndex) {
      // The last point is needed only if the count of turns matches the ends' orientations.
      const targetOrientation = (dir[1]! & (MASK_EAST | MASK_WEST)) > 0 ? 0 : 1;
      const sameOrient = targetOrientation === initialOrientation ? 0 : 1;
      if (sameOrient !== (currentIndex + 1) % 2) break;
    }
    const wp = wayPoints[i]!;
    result.push({ x: Math.round(wp[0]! * 10) / 10, y: Math.round(wp[1]! * 10) / 10 });
  }

  // Removes duplicates.
  let index = 1;
  while (index < result.length) {
    const a = result[index - 1];
    const b = result[index];
    if (!a || !b || a.x !== b.x || a.y !== b.y) index++;
    else result.splice(index, 1);
  }
};
