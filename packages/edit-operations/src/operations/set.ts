// `set <selector> key=value… [all]` (docs/specs/024-agents/blueprints/edit-operations.md "Operations"):
// each target gets the fields in order, through the aliases or as stored fields; no geometry changes
// but named geometry and a shape growing to fit its label. A target the fields leave as it was is
// not touched, so it is never normalised (E1, I2).

import type { EditRejection } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { sameValue } from '../equality';
import { writeFieldsOnto } from '../fields';
import { fitToLabel } from '../labels';
import { layerLockOf } from '../locks';
import { resolveSome } from '../selectors';
import { type EditState, refsOf, refuseLocked, touch, writeFields } from '../state';
import type { SetOperation } from '../types';

// Fields whose change can leave a shape's label outgrowing its box.
const FIT_KEYS: ReadonlySet<string> = new Set(['label', 'shape', 'text', 'textSize']);

export function applySet(
  state: EditState,
  { target, fields, all }: SetOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveSome(state, target, operation, all === true);
  if ('rejection' in resolved) return resolved.rejection;
  for (const el of resolved.els) {
    const rejection = setOne(state, el, fields, operation);
    if (rejection) return rejection;
  }
  return null;
}

function setOne(
  state: EditState,
  el: Element,
  fields: SetOperation['fields'],
  operation: number,
): EditRejection | null {
  const lock = state.locked.get(el.id);
  if (lock) return refuseLocked(state, 'set', operation, el, lock);
  const written = writeFieldsOnto(el, fields, state.theme, refsOf(state).refOf(el.id), operation);
  if ('code' in written) return written;
  const fitted = Object.keys(fields).some((key) => FIT_KEYS.has(key))
    ? fitToLabel(el, written.next)
    : { el: written.next, fit: {} };
  const next = fitted.el;
  if (sameValue(next, el)) return null;
  const layerLock = layerLockOf(state.tab.layers, next.layerId);
  if (layerLock) return refuseLocked(state, 'set', operation, next, layerLock);
  writeFields(state, next, operation, written.written);
  state.warnings.push(...written.warnings);
  for (const warning of written.warnings) {
    if (warning.code === 'label_capped') state.log('[edit-ops] label-capped', { operation });
    if (warning.code === 'shape_coerced')
      state.log('[edit-ops] coerced', { operation, field: 'shape' });
  }
  if (fitted.fit.widened || fitted.fit.taller) {
    const fits = touch(state, el.id, operation);
    fits.fit = { ...fits.fit, ...fitted.fit };
    state.log('[edit-ops] widened', { operation });
  }
  return null;
}
