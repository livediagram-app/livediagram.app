// Typed reads of an element's optional fields, which many element types share under one name. The
// stored tab passed `isValidTab`, but a view never trusts a shape it did not check.
export function fieldOf(source: object, key: string): unknown {
  return Reflect.get(source, key);
}

export function stringField(source: object, key: string): string | null {
  const value = fieldOf(source, key);
  return typeof value === 'string' ? value : null;
}

// A string with something besides whitespace in it.
export function textField(source: object, key: string): string | null {
  const value = stringField(source, key);
  return value !== null && value.trim() !== '' ? value : null;
}

export function numberField(source: object, key: string): number | null {
  const value = fieldOf(source, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function arrayField(source: object, key: string): readonly unknown[] {
  const value = fieldOf(source, key);
  return Array.isArray(value) ? value : [];
}

export function flagField(source: object, key: string): boolean {
  return fieldOf(source, key) === true;
}

export function objectField(source: object, key: string): object | null {
  const value = fieldOf(source, key);
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export type Box = { x: number; y: number; width: number; height: number };

// The stored axis-aligned box, or null for an element without numeric geometry.
export function boxOf(source: object): Box | null {
  const x = numberField(source, 'x');
  const y = numberField(source, 'y');
  const width = numberField(source, 'width');
  const height = numberField(source, 'height');
  return x === null || y === null || width === null || height === null
    ? null
    : { x, y, width, height };
}

// The comments of an element's thread, and whether it is resolved; null without a comment.
export function threadOf(
  source: object,
): { comments: readonly object[]; resolved: boolean } | null {
  const thread = objectField(source, 'commentThread');
  if (thread === null) return null;
  const comments = arrayField(thread, 'comments').filter(isObject);
  return comments.length === 0 ? null : { comments, resolved: flagField(thread, 'resolved') };
}
