// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// Every edge of a page routed as draw.io routes it (blueprint step 12.2-12.6): each end's terminal
// is the cell draw.io draws it to (mxGraphView.getVisibleTerminal), an edge terminal is routed
// first, and a cycle of edges on edges routes its later member as if that end were free.

import { debugLog } from '@/lib/debug-log';
import { absoluteRect, originOf, type DrawioCell, type DrawioGraph } from '../cells';
import type { Pt } from './geometry';
import { drawnPoints, edgeState, vertexState, type CellState } from './state';
import { routeEdge, type RouteEnd } from './view';

export type EdgeRoute = {
  /** Every point of draw.io's route, both ends included, absolute (mxCellState.absolutePoints). */
  points: Pt[];
  /** The points draw.io paints: the route less any point within a pixel of the one before. */
  drawn: Pt[];
  /** The edge as a terminal and as the base of its labels (mxCellState after updateEdgeBounds). */
  state: CellState;
};

/** Routes a page's edges on demand, each once. */
export type PageRouter = (edgeId: string) => EdgeRoute | null;

export function createPageRouter(graph: DrawioGraph): PageRouter {
  const { cells } = graph;
  const routes = new Map<string, EdgeRoute | null>();
  const routing = new Set<string>();
  const vertexStates = new Map<string, CellState | null>();

  const parentOf = (id: string) => cells.get(id)?.parentId ?? null;

  // A state exists only for a cell whose every ancestor below the root is visible.
  const shown = (id: string): boolean => {
    for (let at: string | null = id; at && at !== graph.rootId; at = parentOf(at)) {
      if (!cells.get(at)?.visible) return false;
    }
    return true;
  };

  /** mxGraphView.getVisibleTerminal */
  const visibleTerminal = (id: string | undefined): string | null => {
    if (!id || !cells.has(id)) return null;
    let best = id;
    for (let at: string | null = id; at; at = parentOf(at)) {
      if (!cells.get(best)?.visible || cells.get(at)?.collapsed) best = at;
    }
    if (best === graph.rootId || parentOf(best) === graph.rootId) return null;
    return best;
  };

  const vertexStateOf = (id: string): CellState | null => {
    if (vertexStates.has(id)) return vertexStates.get(id)!;
    const cell = cells.get(id)!;
    const rect = absoluteRect(graph, id);
    const state =
      rect && cell.vertex
        ? vertexState(id, rect, cell.style, cell.geometry?.relative ? cell.geometry.x : null)
        : null;
    vertexStates.set(id, state);
    return state;
  };

  const stateOf = (id: string): CellState | null => {
    if (!shown(id)) return null;
    const cell = cells.get(id)!;
    return cell.edge ? (route(id)?.state ?? null) : vertexStateOf(id);
  };

  // Where an end with no state sits: its own point, else its cell's centre, else the origin.
  const fallbackPoint = (edge: DrawioCell, source: boolean, origin: Pt): Pt => {
    const own = source ? edge.geometry?.sourcePoint : edge.geometry?.targetPoint;
    if (own) return { x: own.x + origin.x, y: own.y + origin.y };
    const id = source ? edge.source : edge.target;
    const rect = id ? absoluteRect(graph, id) : null;
    return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : origin;
  };

  const endOf = (edge: DrawioCell, source: boolean, origin: Pt): RouteEnd => {
    const terminal = visibleTerminal(source ? edge.source : edge.target);
    const state = terminal ? stateOf(terminal) : null;
    if (state) return { kind: 'terminal', state };
    if (terminal || (source ? edge.source : edge.target)) {
      debugLog('[drawio-route] end has no terminal state, routed from a point', {
        edge: edge.id,
        end: source ? 'source' : 'target',
      });
    }
    return { kind: 'point', at: fallbackPoint(edge, source, origin) };
  };

  const route = (edgeId: string): EdgeRoute | null => {
    if (routes.has(edgeId)) return routes.get(edgeId)!;
    if (routing.has(edgeId)) return null; // a cycle: the caller's end routes as a point
    const edge = cells.get(edgeId);
    if (!edge?.edge) return null;
    routing.add(edgeId);
    const origin = originOf(graph, edge.parentId);
    const points = routeEdge({
      style: edge.style,
      origin,
      points: edge.geometry?.points ?? [],
      source: endOf(edge, true, origin),
      target: endOf(edge, false, origin),
      gridSize: graph.gridSize,
      portState: (id) => (cells.has(id) ? stateOf(id) : null),
    });
    routing.delete(edgeId);
    const result =
      points.length >= 2
        ? {
            points,
            drawn: drawnPoints(points),
            state: edgeState(
              edgeId,
              edge.style,
              points,
              edge.geometry?.relative ? edge.geometry.x : null,
            ),
          }
        : null;
    routes.set(edgeId, result);
    return result;
  };

  return route;
}
