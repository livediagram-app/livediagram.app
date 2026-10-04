// `rm <selector> [all] [keep-arrows]` (docs/specs/024-agents/blueprints/edit-operations.md
// "Operations"): arrows attached to what is removed go with it, transitively; with `keepArrows`
// their attached ends are freed where they are drawn instead. A mind node's parent link to a removed
// node is removed (EO30).

import type { EditRejection } from '@livediagram/api-schema';
import {
  endpointPosition,
  type ArrowElement,
  type Element,
  type ElementId,
  type Endpoint,
  type ShapeElement,
} from '@livediagram/document';
import { type EditState, refuseLocked, removeElement, resolveTarget, writeFields } from '../state';
import type { RmOperation } from '../types';

const attachedTo = (end: Endpoint): ElementId | null =>
  end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : null;

// Every arrow by the ids its ends are attached to.
function arrowsByAttachment(state: EditState): Map<ElementId, ArrowElement[]> {
  const attached = new Map<ElementId, ArrowElement[]>();
  for (const el of state.byId.values()) {
    if (el.type !== 'arrow') continue;
    for (const id of new Set([attachedTo(el.from), attachedTo(el.to)])) {
      if (id === null) continue;
      const arrows = attached.get(id);
      if (arrows) arrows.push(el);
      else attached.set(id, [el]);
    }
  }
  return attached;
}

// The arrows removed with `target`, each with the element that pulled it, breadth first.
function cascadeOf(
  target: ElementId,
  attached: ReadonlyMap<ElementId, ArrowElement[]>,
): Map<ElementId, ElementId> {
  const pulled = new Map<ElementId, ElementId>();
  const queue = [target];
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    for (const arrow of attached.get(queue[i]!) ?? []) {
      if (seen.has(arrow.id)) continue;
      seen.add(arrow.id);
      pulled.set(arrow.id, queue[i]!);
      queue.push(arrow.id);
    }
  }
  return pulled;
}

function freeEnds(state: EditState, arrow: ArrowElement, target: ElementId): ArrowElement {
  const free = (end: Endpoint): Endpoint => {
    if (attachedTo(end) !== target) return end;
    const { x, y } = endpointPosition(end, state.byId);
    return { kind: 'free', x, y };
  };
  return { ...arrow, from: free(arrow.from), to: free(arrow.to) };
}

const lockRejection = (state: EditState, el: Element, operation: number) => {
  const lock = state.locked.get(el.id);
  return lock ? refuseLocked(state, 'rm', operation, el, lock) : null;
};

function keepArrows(
  state: EditState,
  target: ElementId,
  arrows: readonly ArrowElement[],
  operation: number,
): EditRejection | null {
  for (const arrow of arrows) {
    const locked = lockRejection(state, arrow, operation);
    if (locked) return locked;
  }
  for (const arrow of arrows) {
    const freed = freeEnds(state, arrow, target);
    const ends = (['from', 'to'] as const).filter((end) => freed[end] !== arrow[end]);
    writeFields(state, freed, operation, ends);
    state.warnings.push({
      code: 'arrows_freed',
      ref: arrow.id,
      message: `${arrow.id} ${ends.join(' and ')} freed where it was drawn: ${target} was removed`,
    });
  }
  return null;
}

// Mind nodes whose parent is removed lose the link and become roots.
function orphansOf(state: EditState, removed: ReadonlySet<ElementId>): ShapeElement[] {
  const orphans: ShapeElement[] = [];
  for (const el of state.byId.values()) {
    if (el.type !== 'shape' || el.mindParentId === undefined || removed.has(el.id)) continue;
    if (removed.has(el.mindParentId)) orphans.push(el);
  }
  return orphans;
}

export function applyRm(
  state: EditState,
  { target, keepArrows: keep }: RmOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveTarget(state, target, operation);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  const targetLocked = lockRejection(state, el, operation);
  if (targetLocked) return targetLocked;
  const attached = arrowsByAttachment(state);
  const pulled = keep ? new Map<ElementId, ElementId>() : cascadeOf(el.id, attached);
  for (const id of pulled.keys()) {
    const locked = lockRejection(state, state.byId.get(id)!, operation);
    if (locked) return locked;
  }
  const removed = new Set([el.id, ...pulled.keys()]);
  const orphans = orphansOf(state, removed);
  for (const orphan of orphans) {
    const locked = lockRejection(state, orphan, operation);
    if (locked) return locked;
  }
  if (keep) {
    const kept = keepArrows(state, el.id, attached.get(el.id) ?? [], operation);
    if (kept) return kept;
  }
  for (const orphan of orphans) {
    const { mindParentId: _removed, ...rest } = orphan;
    writeFields(state, rest, operation, ['mindParentId']);
  }
  removeElement(state, el.id, operation, {});
  for (const [id, by] of pulled) removeElement(state, id, operation, { pinnedTo: by });
  return null;
}
