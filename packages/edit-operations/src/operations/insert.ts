// `insert <kind> [id=] key=value… between <a> <b>` (docs/specs/024-agents/blueprints/edit-operations.md
// "Operations", EO32, EO33): the node sits between a and b on their axis, room is made for it beyond
// the midline, the a→b arrow ends at the node, and a new arrow from the node to b copies its style.

import type { EditRejection } from '@livediagram/api-schema';
import type { ArrowElement, BoxedElement } from '@livediagram/document';
import { describeElement } from '../element-text';
import { mintId } from '../ids';
import { makeRoom, type Axis } from '../make-room';
import { ambiguous } from '../selectors';
import { notConnected } from '../rejections';
import {
  boxedOf,
  noteTarget,
  currentElements,
  insertElement,
  namingOf,
  refsOf,
  refuseLocked,
  touch,
  type EditState,
  writeFields,
} from '../state';
import type { InsertOperation } from '../types';
import { INSERT_MIN_GAP, PLACEMENT_GAP } from '../vocabulary';
import { commitNew, createKind } from './add-kind';
import { facing, pinnedFromTo, resolveBox, withoutRoute } from './connect';

// Fields the new arrow does not copy from the one it continues (EO33).
const NOT_COPIED = new Set([
  'id',
  'from',
  'to',
  'label',
  'labelOffset',
  'labelMaxWidth',
  'curveOffset',
  'curvePoints',
  'elbowOffset',
  'commentThread',
  'link',
]);

const centreOf = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// The flow axis from a to b; overlapping centres read as down (E7).
function axisOf(a: BoxedElement, b: BoxedElement): Axis {
  const [ca, cb] = [centreOf(a), centreOf(b)];
  const [dx, dy] = [cb.x - ca.x, cb.y - ca.y];
  if (dx === 0 && dy === 0) return { horizontal: false, sign: 1 };
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  return { horizontal, sign: (horizontal ? dx : dy) > 0 ? 1 : -1 };
}

// a's far edge on the axis, and the clearance from it to b's near edge.
function edges(a: BoxedElement, b: BoxedElement, axis: Axis) {
  const [start, size] = axis.horizontal ? (['x', 'width'] as const) : (['y', 'height'] as const);
  const far = axis.sign > 0 ? a[start] + a[size] : a[start];
  const near = axis.sign > 0 ? b[start] : b[start] + b[size];
  return { far, clearance: (near - far) * axis.sign };
}

export function applyInsert(
  state: EditState,
  operation: InsertOperation,
  index: number,
): EditRejection | null {
  const a = resolveBox(state, operation.between[0], index);
  if ('rejection' in a) return a.rejection;
  const b = resolveBox(state, operation.between[1], index);
  if ('rejection' in b) return b.rejection;
  const refOf = refsOf(state).refOf;
  const ends = `${refOf(a.el.id)}→${refOf(b.el.id)}`;
  const arrows = currentElements(state).filter((el): el is ArrowElement =>
    pinnedFromTo(el, a.el.id, b.el.id),
  );
  if (arrows.length === 0) {
    const naming = namingOf(state);
    const touching = currentElements(state).filter(
      (el) =>
        el.type === 'arrow' &&
        [el.from, el.to].some(
          (end) =>
            end.kind === 'pinned' && (end.elementId === a.el.id || end.elementId === b.el.id),
        ),
    );
    return notConnected(
      index,
      ends,
      touching.map((el) => describeElement(el, naming)),
      refOf(a.el.id),
      refOf(b.el.id),
    );
  }
  if (arrows.length > 1)
    return ambiguous(
      state,
      ends,
      index,
      arrows.map((el) => el.id),
      { hint: 'rewire one of them by its ref instead' },
    );
  const arrow = arrows[0]!;
  const lock = state.locked.get(arrow.id);
  if (lock) return refuseLocked(state, 'insert', index, arrow, lock);
  noteTarget(state, arrow.id);

  const axis = axisOf(a.el, b.el);
  const { far, clearance } = edges(a.el, b.el, axis);
  const gap = clearance < INSERT_MIN_GAP ? PLACEMENT_GAP : clearance;
  const [ca, cb] = [centreOf(a.el), centreOf(b.el)];
  const made = createKind(state, operation, index, (size) => {
    const extent = axis.horizontal ? size.width : size.height;
    const along = axis.sign > 0 ? far + gap : far - gap - extent;
    return axis.horizontal
      ? { x: Math.round(along), y: Math.round((ca.y + cb.y) / 2 - size.height / 2), ref: a.el }
      : { x: Math.round((ca.x + cb.x) / 2 - size.width / 2), y: Math.round(along), ref: a.el };
  });
  if ('rejection' in made) return made.rejection;
  const refused = commitNew(state, made, 'insert', index);
  if (refused) return refused;
  const node = made.el;
  const extent = axis.horizontal ? node.width : node.height;
  makeRoom(state, { node, b: b.el.id, axis, shift: extent + gap, gap }, index);
  // Making room moves b; it never removes it.
  const movedB = boxedOf(state, b.el.id)!;
  const into = facing(a.el, node);
  const outOf = facing(node, movedB);
  writeFields(
    state,
    withoutRoute({
      ...arrow,
      from: { kind: 'pinned', elementId: a.el.id, anchor: into.from },
      to: { kind: 'pinned', elementId: node.id, anchor: into.to },
    }),
    index,
    ['to'],
  );
  const copied = Object.fromEntries(Object.entries(arrow).filter(([key]) => !NOT_COPIED.has(key)));
  const id = mintId(state, undefined, 'arrow');
  const continuation: ArrowElement = {
    ...copied,
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: node.id, anchor: outOf.from },
    to: { kind: 'pinned', elementId: b.el.id, anchor: outOf.to },
  };
  // The node is the newest element, so later in the order than b.
  insertElement(state, continuation, index, { after: node.id });
  state.created.push(id);
  touch(state, id, index).styleOf = arrow.id;
  return null;
}
