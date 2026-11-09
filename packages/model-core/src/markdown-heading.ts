// An ATX heading's text as CommonMark reads it, for every product's Markdown readers (each product's
// docs/specs/020-import-export/markdown-import.md, livediagram's docs/specs/009-elements/mind-node.md "Edit Outline"):
// its closing sequence dropped. A run of `#` at the end (trailing spaces aside) that is the whole text or follows a
// space or tab closes the heading, so `Section ##` reads "Section", `#` reads "" and `C#` keeps its `#`.
//
// A scan from the end, linear in the line, never a regex such as `\s+#+\s*$`: that one retries from every space of a
// long run and took 1.6 s on a heading of 50,000 spaces.

const isBlank = (c: string) => c === ' ' || c === '\t';

/** `text` is what follows the heading's opening `#`s and their space. */
export function atxHeadingText(text: string): string {
  let end = text.length;
  while (end > 0 && isBlank(text[end - 1]!)) end--;
  let at = end;
  while (at > 0 && text[at - 1] === '#') at--;
  if (at < end && (at === 0 || isBlank(text[at - 1]!))) end = at;
  while (end > 0 && isBlank(text[end - 1]!)) end--;
  let start = 0;
  while (start < end && isBlank(text[start]!)) start++;
  return text.slice(start, end);
}
