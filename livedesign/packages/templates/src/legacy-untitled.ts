// A design's name before anyone names it. Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
export const UNTITLED_DESIGN_NAME = 'Untitled design';

// The default design name was "Untitled diagram" before the container became a design
// (docs/specs/006-design/design-structure.md). Designs stored under it still count as
// untitled, so the first label still names them.

const LEGACY_UNTITLED_NAME = 'Untitled diagram';

export function isUntitledDesignName(name: string): boolean {
  return name === UNTITLED_DESIGN_NAME || name === LEGACY_UNTITLED_NAME;
}
