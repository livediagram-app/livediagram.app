// `connect <a> -> <b> [id=] [label=…] [line=…] [again]` and `rewire <arrow> from=<x> | to=<y>`
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
  const end = 'from' in operation ? 'from' : 'to';
  const other = end === 'from' ? 'to' : 'from';
  const target = resolveBox(state, 'from' in operation ? operation.from : operation.to, index);
  if ('rejection' in target) return target.rejection;
  // The moved end faces the other end; a pinned other end faces back.
  const otherEnd = arrow[other];
  const pinned: Endpoint = {
    kind: 'pinned',
    elementId: target.el.id,
    anchor: bestAnchorTowards(target.el, endpointPosition(otherEnd, state.byId)),
  };
  const otherBox = otherEnd.kind === 'pinned' ? boxedOf(state, otherEnd.elementId) : undefined;
  const otherFacing: Endpoint =
    otherEnd.kind === 'pinned' && otherBox
      ? { ...otherEnd, anchor: bestAnchorTowards(otherBox, centreOf(target.el)) }
      : otherEnd;
  const next = withoutRoute(
    end === 'from'
      ? { ...arrow, from: pinned, to: otherFacing }
      : { ...arrow, from: otherFacing, to: pinned },
  );
  writeFields(state, next, index, [end]);
  return null;
}
