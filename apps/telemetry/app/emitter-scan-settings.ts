// Test support for emitter-scan.ts: the Settings catalogue's emits.
//
// SettingsCategoryPane emits every Settings row generically
// (`track(row.event.category, 'Toggled', next ? row.event.on : row.event.off)`),
// so the events live as data on the rows in settings-catalogue.ts rather than
// in a call. A row is `{ kind, event: { category, on, off } }` for a toggle,
// `{ kind, event: { category, changed } }` for a slider, and a choice row,
// whose type is `changed` + the picked option id capitalised
// (SettingsCategoryPane's choiceTelemetryType).

import ts from 'typescript';
import { COMPUTED, propertyValue, type Emit, type Value } from './emitter-scan';

export function settingsRowEmits(path: string, row: ts.ObjectLiteralExpression): Emit[] {
  const event = propertyValue(row, 'event');
  if (!event || !ts.isObjectLiteralExpression(event)) return [];
  const category = propertyValue(event, 'category');
  const kind = propertyValue(row, 'kind');
  if (!category || !kind || !ts.isStringLiteral(kind) || !ts.isStringLiteral(category)) return [];
  const emit = (action: string, type: Value): Emit => ({
    category: category.text,
    action,
    type,
    path,
  });
  const literal = (key: string) => {
    const v = propertyValue(event, key);
    return v && ts.isStringLiteral(v) ? v.text : COMPUTED;
  };
  if (kind.text === 'toggle') {
    return [emit('Toggled', literal('on')), emit('Toggled', literal('off'))];
  }
  if (kind.text === 'slider') return [emit('Changed', literal('changed'))];
  if (kind.text === 'choice') {
    const changed = literal('changed');
    const options = propertyValue(row, 'options');
    if (changed === COMPUTED || !options || !ts.isArrayLiteralExpression(options)) {
      return [emit('Changed', COMPUTED)];
    }
    return options.elements.map((o) => {
      const id = ts.isObjectLiteralExpression(o) ? propertyValue(o, 'id') : undefined;
      if (!id || !ts.isStringLiteral(id)) return emit('Changed', COMPUTED);
      return emit('Changed', changed + id.text.charAt(0).toUpperCase() + id.text.slice(1));
    });
  }
  return [];
}
