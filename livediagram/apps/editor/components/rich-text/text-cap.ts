// A label editor's character cap (docs/specs/009-elements/badge.md "The element"): a contentEditable has no
// maxLength, so the editor asks this how much of an insertion fits. Pure.

/**
 * The part of `text` that fits a label of `length` characters, `selected` of which the insertion replaces, under
 * `max`. All of it with no cap; nothing once the label is full.
 */
export function capInsertion(
  text: string,
  length: number,
  selected: number,
  max: number | undefined,
): string {
  if (max === undefined) return text;
  const room = max - (length - selected);
  return room <= 0 ? '' : text.slice(0, room);
}
