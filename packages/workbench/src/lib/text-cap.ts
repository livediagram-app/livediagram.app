// A label editor's character cap (each editor's docs/specs/009-elements/badge.md "The element"): a contentEditable
// has no maxLength, so the editor asks this how much of an insertion fits. Lengths are UTF-16 code units, as the
// label's own cap counts them; a cut never splits a surrogate pair, so an emoji goes in whole or not at all.

/**
 * The part of `text` that fits a label of `length` characters, `selected` of which the insertion replaces, under
 * `max`. All of it with no cap; nothing once the label is full. Pure.
 */
export function capInsertion(
  text: string,
  length: number,
  selected: number,
  max: number | undefined,
): string {
  if (max === undefined) return text;
  const room = max - (length - selected);
  if (room <= 0) return '';
  if (room >= text.length) return text;
  // A high surrogate at the cut would be left without its pair: leave the whole character out.
  const last = text.charCodeAt(room - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? room - 1 : room);
}

/**
 * The part of `text` an open label editor (`editor`, its contentEditable) takes under `max`, counting what the
 * selection inside it frees: what each editor's RichTextEditor checks a keystroke, Enter and a paste against.
 */
export function fitInsertion(
  editor: HTMLElement | null,
  text: string,
  max: number | undefined,
): string {
  if (max === undefined || !editor) return text;
  const sel = window.getSelection();
  const selected =
    sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode) ? sel.toString().length : 0;
  return capInsertion(text, (editor.textContent ?? '').length, selected, max);
}
