// Test support for emitter-scan.ts: the Settings catalogue's emits.
//
// Each app's settings-model.tsx (through @liveworkspace/settings-ui's bindRow) emits every
// Settings row generically
// (`track(row.event.category, 'Toggled', next ? row.event.on : row.event.off)`),
// so the events live as data on the rows in settings-catalogue.ts rather than
// in a call. A row is `{ kind, event: { category, on, off } }` for a toggle,
// `{ kind, event: { category, changed } }` for a slider, and a choice row,
// whose type is `changed` + the picked option id capitalised
// (bindRow's choiceTelemetryType).

import {
  isArrayLiteralExpression,
  isObjectLiteralExpression,
  isStringLiteral,
  type ObjectLiteralExpression,
} from 'typescript/unstable/ast';
import { COMPUTED, propertyValue, type Emit, type Value } from './emitter-scan';

export function settingsRowEmits(path: string, row: ObjectLiteralExpression): Emit[] {
  const event = propertyValue(row, 'event');
  if (!event || !isObjectLiteralExpression(event)) return [];
  const category = propertyValue(event, 'category');
  if (!category || !isStringLiteral(category)) return [];
  // A row built by a helper (`emailSwitch('notifyTips', { ..., event })`) or spread from a shared base
  // (`{ ...UI_SCALE_SLIDER, event }`) carries its `kind` elsewhere, so it is read from the event's own keys: an
  // on/off pair is a toggle, a lone `changed` a slider.
  const written = propertyValue(row, 'kind');
  const kind =
    written && isStringLiteral(written)
      ? written.text
      : propertyValue(event, 'on')
        ? 'toggle'
        : propertyValue(event, 'changed')
          ? 'slider'
          : null;
  if (!kind) return [];
  const emit = (action: string, type: Value): Emit => ({
    category: category.text,
    action,
    type,
    path,
  });
  const literal = (key: string) => {
    const v = propertyValue(event, key);
    return v && isStringLiteral(v) ? v.text : COMPUTED;
  };
  if (kind === 'toggle') {
    return [emit('Toggled', literal('on')), emit('Toggled', literal('off'))];
  }
  if (kind === 'slider') return [emit('Changed', literal('changed'))];
  if (kind === 'choice') {
    const changed = literal('changed');
    const options = propertyValue(row, 'options');
    if (changed === COMPUTED || !options || !isArrayLiteralExpression(options)) {
      return [emit('Changed', COMPUTED)];
    }
    return options.elements.map((o) => {
      const id = isObjectLiteralExpression(o) ? propertyValue(o, 'id') : undefined;
      if (!id || !isStringLiteral(id)) return emit('Changed', COMPUTED);
      return emit('Changed', changed + id.text.charAt(0).toUpperCase() + id.text.slice(1));
    });
  }
  return [];
}
