// The one plain-object guard for untrusted input (stored tabs, api bodies,
// imported files): a non-null object that is not an array. Every parser that
// walks unknown JSON narrows through this instead of a private copy.

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
