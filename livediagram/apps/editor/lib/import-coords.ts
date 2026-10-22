// How far from the origin an imported coordinate or size may reach, shared by every file
// importer (docs/specs/020-import-export/board-scene.md "Limits and rejections",
// docs/specs/020-import-export/blueprints/drawio-import.md "Constants"). Far past any real board
// (an Excalidraw or draw.io canvas stops drawing cleanly long before it), and small enough that
// placement offsets, parent offsets and every later sum stay finite: a finite 1e308 in a file
// overflowed to Infinity once it was moved, and the tab saved `null` coordinates.
export const IMPORT_COORD_MAX = 1e7;

/** Whether every number lies within IMPORT_COORD_MAX of zero (NaN never does). */
export const withinImportReach = (...ns: number[]): boolean =>
  ns.every((n) => Math.abs(n) <= IMPORT_COORD_MAX);
