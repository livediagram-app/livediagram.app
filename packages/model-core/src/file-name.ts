// The one file-name rule every editor's export downloads through (each product's
// docs/specs/020-import-export/export-fidelity.md "File names"), so a name is safe on Windows, macOS and
// Linux in any script: brackets `() [] {}` are dropped, any other character that is not a letter or digit
// (Latin, Japanese, Cyrillic, with their combining marks), a dot, a dash, an underscore or a space becomes a
// dash, runs of dashes collapse, runs of spaces become one, and dashes and spaces at either end are trimmed.
// "Plan (v2)?" reads "Plan v2", "会議 - メモ" stays itself, and a name left with nothing ("?") becomes
// `fallback` (the product's word for its document, or "page" for a page label), never a bare ".png".
// The ends are trimmed by a scan, not a `[-\s]+$` regex: that one retries from every dash and space in a
// long "- - -" run inside the name, quadratic (2 s on a 75,000-character name).

const isEdge = (c: string) => c === '-' || c === ' ';

export function sanitizeFilename(name: string, fallback: string): string {
  const safe = name
    .replace(/[()[\]{}]+/g, '')
    .replace(/[^\p{L}\p{M}\p{N}._\- ]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/ +/g, ' ');
  let start = 0;
  let end = safe.length;
  while (start < end && isEdge(safe[start]!)) start++;
  while (end > start && isEdge(safe[end - 1]!)) end--;
  return safe.slice(start, end) || fallback;
}
