// What an import left out, counted by kind (docs/specs/020-import-export/office-import.md "The report"). The readers
// add to it as they meet each thing; the report turns it into lines, in this order.

export const SKIP_KINDS = [
  'tables',
  'footnotes',
  'comments',
  'headersFooters',
  'textBoxes',
  'charts',
  'diagrams',
  'equations',
  'media',
  'embedded',
  'linkedImages',
  'shapes',
  'crowded',
  'longText',
] as const;

export type SkipKind = (typeof SKIP_KINDS)[number];

export type SkipTally = Partial<Record<SkipKind, number>>;

export function addSkip(tally: SkipTally, kind: SkipKind, by = 1): void {
  tally[kind] = (tally[kind] ?? 0) + by;
}
