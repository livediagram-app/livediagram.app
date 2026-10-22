// `add` with a whole raw element, as the MCP's `ops` mode sends it
// (docs/specs/024-agents/blueprints/edit-operations.md "Operations"): taken as given, its geometry
// kept, its id kept when free. Finalise normalises and validates it.

import type { EditRejection } from '@livediagram/api-schema';
import { ELEMENT_FIELD_NAMES, type Element } from '@livediagram/document';
import { layerLockOf } from '../locks';
import { idTaken, unknownField } from '../rejections';
import { type EditState, isTaken, putElement, refuseLocked } from '../state';
import type { AddElementOperation } from '../types';
import { PROTOTYPE_KEYS } from '../vocabulary';

const fieldNamesOf = (type: unknown): readonly string[] =>
  typeof type === 'string' && Object.hasOwn(ELEMENT_FIELD_NAMES, type)
    ? ELEMENT_FIELD_NAMES[type as Element['type']]
    : [];

export function applyAdd(
  state: EditState,
  { element: raw }: AddElementOperation,
  operation: number,
): EditRejection | null {
  const prototypeKey = Object.keys(raw).find((key) => PROTOTYPE_KEYS.has(key));
  if (prototypeKey !== undefined)
    return unknownField(
      operation,
      typeof raw.type === 'string' ? raw.type : 'element',
      prototypeKey,
      fieldNamesOf(raw.type),
    );
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
