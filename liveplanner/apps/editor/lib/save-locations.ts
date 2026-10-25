// Where a new project is stored (docs/specs/006-project/save-locations.md): on the server or in this browser only.
// Nobody is asked: `defaultSaveLocationFor` decides, and `/new` branches its create on the id. A third store (GitHub,
// say) is one id in the union, a rule here for who gets it, and one create branch in /new.

export type SaveLocationId = 'liveplanner' | 'browser';

// Where a new project goes when nobody picked (docs/specs/006-project/save-locations.md "The default
// depends on who is creating"): a guest starts This Browser, so a visitor trying things out never
// leaves an orphan on the server; a signed-in person starts on liveplanner.
export function defaultSaveLocationFor(who: { signedIn: boolean }): SaveLocationId {
  return who.signedIn ? 'liveplanner' : 'browser';
}

// Whether an id resolves to the browser-only IndexedDB store (Offline Mode,
// docs/specs/006-project/offline-mode.md). The only place /new touches that notion.
export function isOfflineLocation(id: SaveLocationId): boolean {
  return id === 'browser';
}
