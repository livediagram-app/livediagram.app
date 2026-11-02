// The canonical line form of an operation (docs/specs/024-agents/blueprints/edit-operations.md
// "Line form"): what a rejection's header prints, and text that parses back to the same operation.
// An `add` with a whole element has no line form; it prints as its JSON form, which parses too. So does a `wrap`
// of two or more compound selectors: the line form joins every non-single member word into one selector.

import { isSingleWord } from './selectors';
import { tokeniseLine } from './tokenise';
import type { EditOperation, FieldValue, Fields, Placement } from './types';
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

const fieldsText = (fields: Fields | undefined) =>
  Object.entries(fields ?? {}).map(([key, value]) => `${key}=${fieldText(value)}`);

// A selector that must stay one word (an end, a placement reference): quoted when it holds space.
const oneWord = (selector: string) =>
  /\s/.test(selector) && !/^"[^"]*"$/.test(selector) ? JSON.stringify(selector) : selector;

function placementText(place: Placement | undefined): string[] {
  if (place === undefined) return [];
  if (place.rel === 'at') return [`at:${place.x},${place.y}`];
  return [
    `${place.rel}:${oneWord(place.ref)}`,
    ...(place.gap !== undefined ? [`gap:${place.gap}`] : []),
  ];
}

function flagsText(operation: EditOperation): string[] {
  return Object.entries(FLAG_MEMBERS)
    .filter(([, member]) => Reflect.get(operation, member) === true)
    .map(([word]) => word);
}

const idText = (id: string | undefined) => (id === undefined ? [] : [`id=${id}`]);

function words(operation: EditOperation): string[] {
  switch (operation.op) {
    case 'add':
      if ('element' in operation) return [JSON.stringify(operation)];
      return [
        'add',
        operation.kind,
        ...idText(operation.id),
        ...fieldsText(operation.fields),
        ...placementText(operation.place),
      ];
    case 'set':
    case 'test':
      return [operation.op, operation.target, ...fieldsText(operation.fields)];
    case 'rm':
    case 'unwrap':
      return [operation.op, operation.target];
    case 'move':
      return [
        'move',
        operation.target,
        ...('by' in operation
          ? [`by=${operation.by[0]},${operation.by[1]}`]
          : placementText(operation.place)),
      ];
    case 'connect':
      return [
        'connect',
        operation.from,
        '->',
        operation.to,
        ...idText(operation.id),
        ...fieldsText(operation.fields),
      ];
    case 'rewire':
      return [
        'rewire',
        operation.target,
        ...(operation.from !== undefined ? [`from=${oneWord(operation.from)}`] : []),
        ...(operation.to !== undefined ? [`to=${oneWord(operation.to)}`] : []),
      ];
    case 'insert':
      return [
        'insert',
        operation.kind,
        ...idText(operation.id),
        ...fieldsText(operation.fields),
        'between',
        oneWord(operation.between[0]),
        oneWord(operation.between[1]),
      ];
    case 'wrap':
      return [
        'wrap',
        ...operation.targets,
        'in',
        operation.in,
        ...idText(operation.id),
        ...fieldsText(operation.fields),
      ];
    case 'order':
      return [
        'order',
        operation.target,
        'to' in operation
          ? operation.to
          : 'above' in operation
            ? `above=${oneWord(operation.above)}`
            : `below=${oneWord(operation.below)}`,
      ];
    case 'layout':
      return [
        'layout',
        operation.target,
        ...(operation.style ? [`style=${operation.style}`] : []),
        ...(operation.direction ? [`direction=${operation.direction}`] : []),
      ];
  }
}

// A selector that is one ref or one quoted label, which `wrap`'s line form keeps as its own target.
function isOneElement(selector: string): boolean {
  const read = tokeniseLine(selector);
  return !('error' in read) && read.words.length === 1 && isSingleWord(read.words[0]!);
}

export function formatOperation(operation: EditOperation): string {
  if (operation.op === 'wrap' && operation.targets.filter((t) => !isOneElement(t)).length > 1)
    return JSON.stringify(operation);
  const head = words(operation);
  if (operation.op === 'add' && 'element' in operation) return head[0]!;
  return [...head, ...flagsText(operation)].join(' ');
}
