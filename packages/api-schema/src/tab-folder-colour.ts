// A tab folder's chosen colour (each product's docs/specs/006-*/tab-folders.md "Folder colour"): one of eight hue
// names, stored on every member's link row (`folder_color`) and carried as `folderColor` on the wire. A name, never a
// colour value, so each appearance keeps its own ink for it and nothing stored is a colour the tab bar can't read.
// No value is Automatic: the folder takes the hue its name picks (@liveworkspace/workbench folder-colour.ts).

export const TAB_FOLDER_COLOURS = [
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
  'pink',
] as const;

export type TabFolderColour = (typeof TAB_FOLDER_COLOURS)[number];

const NAMES: ReadonlySet<string> = new Set(TAB_FOLDER_COLOURS);

/** Whether `value` is one of the folder hue names. */
export function isTabFolderColour(value: unknown): value is TabFolderColour {
  return typeof value === 'string' && NAMES.has(value);
}

/** A stored or received colour as the tab carries it: the hue name, or undefined for Automatic (and anything else). */
export function tabFolderColourOf(value: unknown): TabFolderColour | undefined {
  return isTabFolderColour(value) ? value : undefined;
}
