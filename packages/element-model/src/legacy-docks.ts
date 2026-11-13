// Loading a board saved while anchor docking existed.
//
// A docked note stored its relation as `esDock = { hostId, side }`. Docking is
// retired, so this runs where stored tabs enter (the api worker's `rowToTab`,
// the offline store's tab load and a file import) and drops the relation. The
// note stays exactly where it is.

// One copy for livedesign and livediagram.

const hasLegacyDock = (el: object): boolean => 'esDock' in el;

export function dropLegacyDocks<E extends object>(elements: E[]): E[] {
  if (!elements.some(hasLegacyDock)) return elements;
  return elements.map((el) => {
    if (!hasLegacyDock(el)) return el;
    const { esDock: _gone, ...rest } = el as E & { esDock?: unknown };
    void _gone;
    return rest as E;
  });
}
