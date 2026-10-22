// `add` with a whole element (docs/specs/024-agents/blueprints/edit-operations.md "Operations"): taken as given, its
// geometry kept, its id kept when free. Only an element a Plan tab holds is taken (../plan-elements); finalise
// normalises and validates it.

import type { EditRejection } from '@liveplanner/api-schema';
import type { Element } from '@liveplanner/project';
import { layerLockOf } from '../locks';
import { PLAN_KINDS_HINT, planElementIssue, planFieldsOf } from '../plan-elements';
import { idTaken, unknownField } from '../rejections';
import { type EditState, isTaken, putElement, refuseLocked } from '../state';
import type { AddOperation } from '../types';
import { PROTOTYPE_KEYS } from '../vocabulary';

export function applyAdd(
  state: EditState,
  { element: raw }: AddOperation,
  operation: number,
): EditRejection | null {
  const prototypeKey = Object.keys(raw).find((key) => PROTOTYPE_KEYS.has(key));
  if (prototypeKey !== undefined)
    return unknownField(
      operation,
      typeof raw.shape === 'string' ? raw.shape : 'element',
      prototypeKey,
      planFieldsOf(raw as unknown as Element),
    );
  const issue = planElementIssue(raw);
  if (issue) {
    state.log('[edit-ops] not-plan', { operation });
    return { code: 'invalid_value', operation, details: [issue], hint: PLAN_KINDS_HINT };
  }
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : state.makeId();
  if (isTaken(state, id)) {
    const holder = state.byId.get(id) ?? state.before.get(id)!;
    return idTaken(operation, holder, new Set([...state.before.keys(), ...state.byId.keys()]));
  }
  const el = { ...raw, id } as Element;
  const layerLock = layerLockOf(state.tab.layers, el.layerId);
  if (layerLock) return refuseLocked(state, 'add', operation, el, layerLock);
  putElement(state, el, operation);
  if (!state.created.includes(id)) state.created.push(id);
  return null;
}
