// Where a new design is stored (docs/specs/006-design/save-locations.md): on the server or in this browser only.
// Nobody is asked: `defaultSaveLocationFor` decides, and `/new` branches its create on the id. A third store (GitHub,
// say) is one id in the union, a rule here for who gets it, and one create branch in /new.

export type SaveLocationId = 'livedesign' | 'browser';

// Where a new design goes when nobody picked (docs/specs/006-design/save-locations.md "The default
// depends on who is creating"): a guest starts This Browser, so a visitor trying things out never
// leaves an orphan on the server; a signed-in person, or anyone on a deployment without sign-in,
// starts on livedesign.
export function defaultSaveLocationFor(who: {
  signedIn: boolean;
  signInEnabled: boolean;
}): SaveLocationId {
  return who.signInEnabled && !who.signedIn ? 'browser' : 'livedesign';
}

// Whether an id resolves to the browser-only IndexedDB store (Offline Mode,
// docs/specs/006-design/offline-mode.md). The only place /new touches that notion.
export function isOfflineLocation(id: SaveLocationId): boolean {
  return id === 'browser';
}
