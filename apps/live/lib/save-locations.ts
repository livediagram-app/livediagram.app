// Where a new diagram is stored (spec/141). The New Diagram wizard's Settings
// step renders one tile per entry; `/new` branches its create on the id.
//
// This used to be a boolean ("Save Offline, This Browser Only"), which could
// only ever answer yes or no. A catalogue is what a third store (Google Drive,
// GitHub) can be added to: one id in the union, one entry here, one glyph in
// the picker's icon map (typed on the id, so a missing glyph fails to compile),
// and one create branch in /new. Only shipped locations belong here: no
// "coming soon" entries.

export type SaveLocationId = 'livediagram' | 'browser';

export type SaveLocation = {
  id: SaveLocationId;
  label: string;
  // The one-line caption under the tile label.
  description: string;
};

// Display order. The default is first.
export const SAVE_LOCATIONS: readonly SaveLocation[] = [
  { id: 'livediagram', label: 'livediagram', description: 'Your account' },
  { id: 'browser', label: 'Local Browser', description: 'This device only' },
];

export const DEFAULT_SAVE_LOCATION: SaveLocationId = 'livediagram';

export function saveLocationLabel(id: SaveLocationId): string {
  return SAVE_LOCATIONS.find((l) => l.id === id)?.label ?? id;
}

// Whether an id resolves to the browser-only IndexedDB store (Offline Mode,
// spec/76). The only place the wizard's model touches that notion.
export function isOfflineLocation(id: SaveLocationId): boolean {
  return id === 'browser';
}
