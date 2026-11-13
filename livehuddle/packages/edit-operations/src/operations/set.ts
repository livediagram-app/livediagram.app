// `set <selector> key=value… [all]` (docs/specs/024-agents/blueprints/edit-operations.md "Operations"):
// each target gets the fields in order, through the aliases or as stored fields; no geometry changes
// but named geometry and a shape growing to fit its label. A target the fields leave as it was is
// not touched, so it is never normalised (E1, I2).

import type { EditRejection } from '@livehuddle/api-schema';
import { isRetiredElement, retiredElementName, type Element } from '@livehuddle/document';
import { sameValue } from '../equality';
import { writeFieldsOnto } from '../fields';
import { fitToLabel } from '../labels';
import { retiredElementRefusal } from '../rejections';
import { resolveSome } from '../selectors';
import { type EditState, refsOf, touch, writeFields } from '../state';
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
  // A retired element stays as stored (Work Tracker 639): named, or the only kind an `all` matched, it refuses the
  // changeset; among live ones an `all` passes it by.
  const live = resolved.els.filter((el) => !isRetiredElement(el));
  const first = resolved.els[0];
  if (first && (live.length === 0 || (all !== true && isRetiredElement(first))))
    return retiredElementRefusal(
      operation,
      refsOf(state).refOf(first.id),
      retiredElementName(first),
    );
  for (const el of live) {
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
  const written = writeFieldsOnto(el, fields, state.theme, refsOf(state).refOf(el.id), operation);
  if ('code' in written) return written;
  const fitted = Object.keys(fields).some((key) => FIT_KEYS.has(key))
    ? fitToLabel(el, written.next)
    : { el: written.next, fit: {} };
  const next = fitted.el;
  if (sameValue(next, el)) return null;
  writeFields(state, next, operation, written.written);
  state.warnings.push(...written.warnings);
  for (const warning of written.warnings) {
    if (warning.code === 'label_capped') state.log('[edit-ops] label-capped', { operation });
  }
  if (fitted.fit.widened || fitted.fit.taller) {
    const fits = touch(state, el.id, operation);
    fits.fit = { ...fits.fit, ...fitted.fit };
    state.log('[edit-ops] widened', { operation });
  }
  return null;
}
