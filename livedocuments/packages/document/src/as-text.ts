/** A value read as text: text as given, a number or a flag as written; anything else (an object, a
 *  list, nothing) is no text. What a label, a name or a cell reads as when it arrives as another type. */
export const asText = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint'
      ? String(v)
      : '';
