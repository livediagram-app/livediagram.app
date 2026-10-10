// The words the hero's headline cycles through (docs/specs/019-marketing/marketing-site.md "Hero"),
// in order: "Diagram together, live." first, as the static HTML reads.
export const HERO_WORDS: readonly { word: string }[] = [
  'Diagram',
  'Document',
  'Workshop',
  'Whiteboard',
  'Illustrate',
  'Plan',
  'Brainstorm',
].map((word) => ({ word }));
