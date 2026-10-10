// `connect <a> -> <b> [id=] [label=…] [line=…] [again]` and `rewire <arrow> from=<x> | to=<y> | both`
// (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO29, EO31): a pinned arrow
// between boxes, anchors facing each other; a second arrow a→b needs `again`. Rewiring moves one end
// and re-anchors both, dropping the old route.

import type { EditRejection } from '@livediagram/api-schema';
import {
  bestAnchorTowards,
  createPinnedArrow,
  recolourElementForTheme,
  endpointPosition,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Endpoint,
} from '@livediagram/document';
import { describeElement } from '../element-text';
import { writeFieldsOnto } from '../fields';
import { newElementId } from '../ids';
import { arrowExists } from '../rejections';
import { resolveOne } from '../selectors';
import {
  boxedOf,
  currentElements,
  insertElement,
  namingOf,
  refsOf,
  refuseLocked,
  type EditState,
  writeFields,
} from '../state';
import type { ConnectOperation, RewireOperation } from '../types';
import { layerFor } from './add-kind';

const centreOf = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// The anchors two boxes face each other with.
export function facing(a: BoxedElement, b: BoxedElement) {
  return { from: bestAnchorTowards(a, centreOf(b)), to: bestAnchorTowards(b, centreOf(a)) };
}

// The route fields an arrow drops when its ends move (EO31).
export function withoutRoute(arrow: ArrowElement): ArrowElement {
  const { curveOffset: _c, curvePoints: _p, elbowOffset: _e, ...rest } = arrow;
  return rest;
}

export const pinnedFromTo = (arrow: Element, a: string, b: string) =>
  arrow.type === 'arrow' &&
  arrow.from.kind === 'pinned' &&
  arrow.from.elementId === a &&
  arrow.to.kind === 'pinned' &&
  arrow.to.elementId === b;

// One box a word names, or why not.
export function resolveBox(
  state: EditState,
  word: string,
  operation: number,
): { el: BoxedElement } | { rejection: EditRejection } {
  const resolved = resolveOne(state, word, operation);
  if ('rejection' in resolved) return resolved;
  const { el } = resolved;
  if (el.type !== 'arrow') return { el };
  return {
    rejection: {
      code: 'invalid_value',
      operation,
      details: [`${word}: ${refsOf(state).refOf(el.id)} is an arrow; arrows connect boxes`],
      hint: 'name the boxes at its ends instead',
    },
  };
}

export function applyConnect(
  state: EditState,
  operation: ConnectOperation,
  index: number,
): EditRejection | null {
  const a = resolveBox(state, operation.from, index);
  if ('rejection' in a) return a.rejection;
  const b = resolveBox(state, operation.to, index);
  if ('rejection' in b) return b.rejection;
  const refOf = refsOf(state).refOf;
  if (a.el.id === b.el.id)
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.from} -> ${operation.to}: an arrow joins two different boxes`],
      hint: 'name another box for one end',
    };
  const existing = currentElements(state).find((el) => pinnedFromTo(el, a.el.id, b.el.id));
  if (existing && !operation.again)
    return arrowExists(
      index,
      `${refOf(a.el.id)}→${refOf(b.el.id)}`,
      describeElement(existing, namingOf(state)),
    );
  const label = operation.fields?.label;
  const id = newElementId(
    state,
    { given: operation.id, label: typeof label === 'string' ? label : undefined, kind: 'arrow' },
    index,
  );
  if (typeof id !== 'string') return id;
  const anchors = facing(a.el, b.el);
  const base = { ...createPinnedArrow(a.el.id, anchors.from, b.el.id, anchors.to), id };
  const written = writeFieldsOnto(base, operation.fields ?? {}, state.theme, id, index);
  if ('code' in written) return written;
  const layerId = layerFor(state, a.el);
  const arrow = recolourElementForTheme(
    layerId === undefined ? written.next : { ...written.next, layerId },
    state.theme,
  );
  state.warnings.push(...written.warnings);
  const later = state.order.indexOf(a.el.id) > state.order.indexOf(b.el.id) ? a.el.id : b.el.id;
  insertElement(state, arrow, index, { after: later });
  state.created.push(id);
  return null;
}

export function applyRewire(
  state: EditState,
  operation: RewireOperation,
  index: number,
): EditRejection | null {
  const resolved = resolveOne(state, operation.target, index);
  if ('rejection' in resolved) return resolved.rejection;
  const arrow = resolved.el;
  if (arrow.type !== 'arrow')
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.target}: ${refsOf(state).refOf(arrow.id)} is not an arrow`],
      hint: 'rewire an arrow by its ref, from the graph view',
    };
  const lock = state.locked.get(arrow.id);
  if (lock) return refuseLocked(state, 'rewire', index, arrow, lock);
  const fromBox = operation.from !== undefined ? resolveBox(state, operation.from, index) : null;
  if (fromBox && 'rejection' in fromBox) return fromBox.rejection;
  const toBox = operation.to !== undefined ? resolveBox(state, operation.to, index) : null;
  if (toBox && 'rejection' in toBox) return toBox.rejection;
  // The box each end lands on: a named one, or the box an unnamed pinned end already holds.
  const fromId = fromBox ? fromBox.el.id : pinnedId(arrow.from);
  const toId = toBox ? toBox.el.id : pinnedId(arrow.to);
  // As connect refuses (E18): an arrow joins two different boxes, so rewire never makes a self-loop.
  if (fromId !== undefined && fromId === toId) {
    const named = [
      operation.from !== undefined ? `from=${operation.from}` : '',
      operation.to !== undefined ? `to=${operation.to}` : '',
    ].filter(Boolean);
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.target} ${named.join(' ')}: an arrow joins two different boxes`],
      hint: 'name another box for that end',
    };
  }
  const endFacing = (
    end: Endpoint,
    box: BoxedElement | undefined,
    towards: { x: number; y: number },
  ): Endpoint =>
    box ? { kind: 'pinned', elementId: box.id, anchor: bestAnchorTowards(box, towards) } : end;
  const fromEl =
    fromBox?.el ??
    (arrow.from.kind === 'pinned' ? boxedOf(state, arrow.from.elementId) : undefined);
  const toEl =
    toBox?.el ?? (arrow.to.kind === 'pinned' ? boxedOf(state, arrow.to.elementId) : undefined);
  // A moved end faces the other end's box when that moved too, else its current point.
  const towardsTo = toBox ? centreOf(toBox.el) : endpointPosition(arrow.to, state.byId);
  const towardsFrom = fromBox ? centreOf(fromBox.el) : endpointPosition(arrow.from, state.byId);
  const next = withoutRoute({
    ...arrow,
    from:
      arrow.from.kind === 'pinned' || fromBox
        ? endFacing(arrow.from, fromEl, towardsTo)
        : arrow.from,
    to: arrow.to.kind === 'pinned' || toBox ? endFacing(arrow.to, toEl, towardsFrom) : arrow.to,
  });
  const moved = [...(fromBox ? (['from'] as const) : []), ...(toBox ? (['to'] as const) : [])];
  writeFields(state, next, index, moved);
  return null;
}

function pinnedId(end: Endpoint): string | undefined {
  return end.kind === 'pinned' ? end.elementId : undefined;
}
