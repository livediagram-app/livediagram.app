// Shared display-casing helper. Raises the first letter of each word
// WITHOUT lowering the rest, so a lowercased preset value (theme names
// like `mint`, template ids like `flowchart`) renders as Title Case
// while an acronym or PascalCase value (`PNG`, `JSON`, `ER`, `UML`,
// `FormatPainter`, `ShareLink`) is left intact.
//
// Lives here because both the live editor (template titles) and the
// telemetry dashboard (action / type enum values, which are this
// package's own TELEMETRY_* vocabulary) need the exact same rule — an
// identical one-liner had been copy-pasted into each. Keeping one
// definition stops the two surfaces drifting on how a preset value is
// capitalised for display.
export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The words a UI label keeps lowercase unless they lead it: short articles,
// conjunctions and prepositions (docs/specs/004-interface-design/menus.md "Item labels").
const HEADLINE_SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'at',
  'by',
  'with',
  'from',
  'as',
]);

// Title Case for a UI label: raises the first letter of each word, leaving
// the rest as they are ("OK hand" -> "OK Hand"), except the small words above
// after the first ("Arrow to the right" -> "Arrow to the Right").
export function headlineCase(value: string): string {
  return value
    .split(' ')
    .map((word, i) =>
      i > 0 && HEADLINE_SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
