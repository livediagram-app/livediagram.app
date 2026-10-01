// Loading a board saved while anchor docking existed (docs/specs/021-event-storming/event-storming.md Phase 7).
//
// A docked note stored its relation as `esDock = { hostId, side }`. Docking is
// retired, so this runs where stored tabs enter (the api worker's `rowToTab`,
// the offline store's tab load and a file import) and drops the relation. The
// note stays exactly where it is.

import type { Element } from './index';

const hasLegacyDock = (el: Element): boolean => 'esDock' in el;

export function dropLegacyDocks(elements: Element[]): Element[] {
  if (!elements.some(hasLegacyDock)) return elements;
  return elements.map((el) => {
    if (!hasLegacyDock(el)) return el;
    const { esDock: _gone, ...rest } = el as Element & { esDock?: unknown };
    void _gone;
    return rest as Element;
  });
}
