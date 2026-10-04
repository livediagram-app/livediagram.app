// `wrap <selector…> in frame|lane [id=] key=value… [tidy] [absorb | make-room]`
// (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO34, EO35): a frame or lane drawn
// around the members, `FRAME_PAD` clear of them (a frame `FRAME_TOP` at the top, a lane its gutter on
// its title edge). It never silently takes in what is not a member: such bystanders refuse the
// changeset unless `absorb` makes them members or `make-room` moves them out.

import type { EditRejection } from '@livediagram/api-schema';
import {
  FRAME_PAD,
  FRAME_TOP,
  containerContents,
  createShape,
  deriveContainers,
  laneEdgeOfElement,
  laneSizeOfElement,
  recolourElementForTheme,
  type BoxedElement,
  type Element,
  type ElementId,
  type ShapeElement,
} from '@livediagram/document';
import { describeElement } from '../element-text';
import { writeFieldsOnto } from '../fields';
import { newElementId } from '../ids';
import { shifted, type Box } from '../placement';
import { frameCaptures } from '../rejections';
import { resolveMembers } from '../selectors';
import {
  boxedOf,
  currentElements,
  insertElement,
  moveElement,
  namingOf,
  refuseLocked,
  type EditState,
} from '../state';
import type { WrapOperation } from '../types';
import { PLACEMENT_GAP } from '../vocabulary';
import { layerFor } from './add-kind';
import { layOut, lockedAmong } from './layout';

// The boxed members, in element order, or why not.
function membersOf(
  state: EditState,
  targets: readonly string[],
  operation: number,
): { members: BoxedElement[] } | { rejection: EditRejection } {
  const resolved = resolveMembers(state, targets, operation);
  if ('rejection' in resolved) return resolved;
  const members = resolved.els.filter((el): el is BoxedElement => el.type !== 'arrow');
  if (members.length > 0) return { members };
  return {
    rejection: {
      code: 'invalid_value',
      operation,
      details: [`${targets.join(' ')}: only arrows; a frame or lane holds boxes`],
      hint: 'name the boxes the arrows join',
    },
  };
}

// The members' bounding box grown by the padding: a frame's title room at the top, a lane's gutter
// on its title edge (EO34).
export function wrapBox(members: readonly Box[], container: ShapeElement): Box {
  const left = Math.min(...members.map((m) => m.x));
  const top = Math.min(...members.map((m) => m.y));
  const right = Math.max(...members.map((m) => m.x + m.width));
  const bottom = Math.max(...members.map((m) => m.y + m.height));
  const pad = { left: FRAME_PAD, top: FRAME_PAD, right: FRAME_PAD, bottom: FRAME_PAD };
  if (container.shape === 'frame') pad.top = FRAME_TOP;
  else {
    const edge = laneEdgeOfElement(container);
    if (edge !== 'centre-x') pad[edge] += laneSizeOfElement(container);
  }
  return {
    x: left - pad.left,
    y: top - pad.top,
    width: right - left + pad.left + pad.right,
    height: bottom - top + pad.top + pad.bottom,
  };
}

// The boxed non-members the container would become the holder of.
function bystandersOf(
  state: EditState,
  container: Element,
  members: ReadonlySet<ElementId>,
): BoxedElement[] {
  const holders = deriveContainers([container, ...currentElements(state)]);
  return currentElements(state).filter(
    (el): el is BoxedElement =>
      el.type !== 'arrow' && !members.has(el.id) && holders.get(el.id) === container.id,
  );
}

// The shift that puts `el` `PLACEMENT_GAP` outside the nearest edge of `box` (EO35).
export function clearOf(el: Box, box: Box): [number, number] {
  const ways: [number, number][] = [
    [box.x - PLACEMENT_GAP - (el.x + el.width), 0],
    [box.x + box.width + PLACEMENT_GAP - el.x, 0],
    [0, box.y - PLACEMENT_GAP - (el.y + el.height)],
    [0, box.y + box.height + PLACEMENT_GAP - el.y],
  ];
  const travel = ([dx, dy]: [number, number]) => Math.abs(dx) + Math.abs(dy);
  return ways.reduce((best, way) => (travel(way) < travel(best) ? way : best));
}

function moveOut(
  state: EditState,
  bystanders: readonly BoxedElement[],
  box: Box,
  members: ReadonlySet<ElementId>,
  operation: number,
): EditRejection | null {
  for (const el of bystanders) {
    const lock = state.locked.get(el.id);
    if (lock) return refuseLocked(state, 'wrap', operation, el, lock);
  }
  const before = currentElements(state);
  for (const bystander of bystanders) {
    const [dx, dy] = clearOf(bystander, box);
    for (const id of containerContents(before, new Set([bystander.id]))) {
      if (members.has(id) || state.locked.has(id)) continue;
      const moved = shifted(state.byId.get(id)!, dx, dy);
      moveElement(state, moved, operation, 'make room', { shift: [dx, dy] });
    }
  }
  return null;
}

export function applyWrap(
  state: EditState,
  operation: WrapOperation,
  index: number,
): EditRejection | null {
  const found = membersOf(state, operation.targets, index);
  if ('rejection' in found) return found.rejection;
  let members = found.members;
  if (operation.tidy) {
    const locked = lockedAmong(state, members, 'wrap', index);
    if (locked) return locked;
    layOut(state, members, 'flow', undefined, index);
    members = members.map((el) => boxedOf(state, el.id)!);
  }

  const label = operation.fields?.label;
  const id = newElementId(
    state,
    {
      given: operation.id,
      label: typeof label === 'string' ? label : undefined,
      kind: operation.in,
    },
    index,
  );
  if (typeof id !== 'string') return id;
  const written = writeFieldsOnto(
    { ...createShape(operation.in, 0, 0), id },
    operation.fields ?? {},
    state.theme,
    id,
    index,
  );
  if ('code' in written) return written;
  const shaped = written.next;
  const sized = (over: readonly BoxedElement[]): ShapeElement => ({
    ...shaped,
    ...wrapBox(over, shaped),
  });
  let container = sized(members);
  let memberIds = new Set(members.map((el) => el.id));
  const bystanders = bystandersOf(state, container, memberIds);
  if (bystanders.length > 0) {
    const resolution = operation.absorb ? 'absorb' : operation.makeRoom ? 'make-room' : 'refused';
    state.log('[edit-ops] frame-captures', {
      operation: index,
      bystanders: bystanders.length,
      resolution,
    });
    if (resolution === 'refused') {
      const naming = namingOf(state);
      const [x, y] = [
        Math.round(container.x - state.origin.x),
        Math.round(container.y - state.origin.y),
      ];
      const where = `${operation.in} @${x},${y} ${container.width}×${container.height}`;
      return frameCaptures(
        index,
        where,
        bystanders.map((el) => describeElement(el, naming)),
      );
    }
    if (resolution === 'absorb') {
      members = currentElements(state).filter(
        (el): el is BoxedElement =>
          el.type !== 'arrow' && (memberIds.has(el.id) || bystanders.includes(el as BoxedElement)),
      );
      memberIds = new Set(members.map((el) => el.id));
      container = sized(members);
    } else {
      const refused = moveOut(state, bystanders, container, memberIds, index);
      if (refused) return refused;
    }
  }
  const earliest = members[0]!;
  const layerId = layerFor(state, earliest);
  const placed = recolourElementForTheme(
    layerId === undefined ? container : { ...container, layerId },
    state.theme,
  );
  state.warnings.push(...written.warnings);
  insertElement(state, placed, index, { before: earliest.id });
  state.created.push(id);
  return null;
}
