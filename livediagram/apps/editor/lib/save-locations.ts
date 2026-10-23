// Where a new document is stored (docs/specs/006-document/save-locations.md): on the server or in this browser only.
// Nobody is asked: `defaultSaveLocationFor` decides, and `/new` branches its create on the id. A third store (GitHub,
// say) is one id in the union, a rule here for who gets it, and one create branch in /new.

export type SaveLocationId = 'livediagram' | 'browser';

// Where a new document goes when nobody picked (docs/specs/006-document/save-locations.md "The default"): livediagram, for
// everyone. A guest has a liveworkspace guest identity (liveworkspace/docs/accounts.md "Guests"), so their documents are
// index items like anyone's, listed in the Explorer, and signing in moves them to the account. This Browser
// (Offline Mode) is only ever chosen on purpose.
export function defaultSaveLocationFor(): SaveLocationId {
  return 'livediagram';
}

// Whether an id resolves to the browser-only IndexedDB store (Offline Mode,
// docs/specs/006-document/offline-mode.md). The only place /new touches that notion.
export function isOfflineLocation(id: SaveLocationId): boolean {
  return id === 'browser';
}
