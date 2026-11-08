// The order of the sections inside a Settings category (liveworkspace/docs/specs/010-site/site.md "Settings", "Order
// inside a category"): the broadest first, the ones only one mode or app has after, so a section reads in the same
// place in every app's Settings and in the panel's merged categories, whichever app the panel was opened for and
// whichever source a section's first row came from. Each app's catalogue lists its sections in this order too
// (sections.test.ts checks the derived catalogues).
//
// A name means one section wherever it is used, so it ranks the same in every category. A section not listed here
// (the Profile's, a category's only one) keeps the place its first row gave it.
export const SECTION_ORDER = [
  // Editor: what every canvas does, then the mouse, then each mode's own.
  'Canvas',
  'Mouse',
  'Draw',
  'Pages',
  'Logo Pages',
  // Presenting: what is shown, how it moves on, what shows while it runs.
  'Slides',
  'Playback',
  'While Presenting',
  // Panels: after Panel Opacity (every panel's), the editing panels, then the Map, then the people.
  'Layers',
  'Quick Style',
  'Map',
  'Collaborate',
  // Getting Started: the tours to offer again, then the element tours (closed).
  'Offer Again',
  'Show Me',
  // Explorer: after Show Home Banner, where new files go.
  'Default Folders',
  // Notifications: in the editor, then by email, then on a phone.
  'In the Editor',
  'Email',
  'Phone',
] as const;

const RANK = new Map<string, number>(SECTION_ORDER.map((name, i) => [name, i]));

/** A section's place in SECTION_ORDER, or -1 for one it doesn't list. */
export function sectionRank(section: string | undefined): number {
  return section === undefined ? -1 : (RANK.get(section) ?? -1);
}
