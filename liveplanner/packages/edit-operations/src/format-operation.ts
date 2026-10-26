// The canonical line form of an operation (docs/specs/024-agents/blueprints/edit-operations.md
// "Line form"): what a rejection's header prints, and text that parses back to the same operation.
// An `add` takes a whole element, which has no line form; it prints as its JSON form, which parses too.

import type { EditOperation, FieldValue, Fields } from './types';
import { FLAG_MEMBERS } from './vocabulary';

const JSON_LOOKALIKE = /^(-?\d|\[|\{|true$|false$)/;

// A string value: bare when it reads back as the same string, else a JSON string.
function stringValue(text: string): string {
  const bare =
    text !== '' && !/[\s"'=:]/.test(text) && !text.startsWith('#') && !JSON_LOOKALIKE.test(text);
  return bare ? text : JSON.stringify(text);
}

// A field's value: strings as above, `null` as nothing (`key=` unsets), the rest as JSON, whose
// spaces sit inside its strings and so inside one word.
function fieldText(value: FieldValue): string {
  if (value === null) return '';
  if (typeof value === 'string') return stringValue(value);
  return JSON.stringify(value);
}

const fieldsText = (fields: Fields) =>
  Object.entries(fields).map(([key, value]) => `${key}=${fieldText(value)}`);

function flagsText(operation: EditOperation): string[] {
  return Object.entries(FLAG_MEMBERS)
    .filter(([, member]) => Reflect.get(operation, member) === true)
    .map(([word]) => word);
}

export function formatOperation(operation: EditOperation): string {
  switch (operation.op) {
    case 'add':
      return JSON.stringify(operation);
    case 'set':
    case 'test':
      return [
        operation.op,
        operation.target,
        ...fieldsText(operation.fields),
        ...flagsText(operation),
      ].join(' ');
    case 'rm':
      return ['rm', operation.target, ...flagsText(operation)].join(' ');
  }
}
