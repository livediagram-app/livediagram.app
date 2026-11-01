// An instance's line (docs/specs/024-agents/design-views.md "The outline", blueprint VW70): the main it draws, by
// name, and which of its main's elements its overrides touch. An instance is one element in every view; its main's
// elements are listed by the `components` view, never here.
import {
  COMPONENT_OVERRIDE_FIELDS,
  INSTANCE_SHAPE,
  type ComponentLookup,
  type Element,
} from '@livedesign/design';
import { LABEL_CUT_CHARS } from './constants';
import { isObject, objectField, stringField } from './fields';
import { attrValue, jsonString } from './text';

// ` overrides=2 fields=label,fillColor`: how many main elements are overridden, and the fields, in the Overrides
// section's order; empty when it has none.
function overridesText(el: Element): string {
  const overrides = objectField(el, 'componentOverrides');
  if (overrides === null) return '';
  const entries = Object.values(overrides).filter(isObject);
  if (entries.length === 0) return '';
  const fields = COMPONENT_OVERRIDE_FIELDS.filter((f) => entries.some((o) => f in o));
  return ` overrides=${entries.length}${fields.length ? ` fields=${fields.join(',')}` : ''}`;
}

/** `instance of "Nav bar" overrides=2 fields=label,fillColor` for an instance, else null. `componentOf` is null when
 *  the caller read no library: the main is then named by its id, `(main not loaded)`. */
export function instanceSummaryOf(el: Element, componentOf: ComponentLookup | null): string | null {
  if (el.type !== 'shape' || el.shape !== INSTANCE_SHAPE) return null;
  const id = stringField(el, 'componentId');
  const main = id === null ? undefined : componentOf?.(id);
  const named =
    main !== undefined
      ? jsonString(main.name, LABEL_CUT_CHARS)
      : id === null
        ? '? (no componentId)'
        : `${attrValue(id)} (${componentOf === null ? 'main not loaded' : 'main missing'})`;
  return `instance of ${named}${overridesText(el)}`;
}
