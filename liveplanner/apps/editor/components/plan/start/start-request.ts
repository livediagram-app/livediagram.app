// A one-shot request for which Start Planning category a new tab opens on (docs/specs/026-plan/plan-overview.md "Tabs":
// the Overview's Add Tab tile starts a Board, Sheet, Dashboard or Form tab directly). The Overview asks just before it
// adds the tab; the new tab's Start Planning takes it as it mounts, so it is used once and never leaks to a later tab.
import type { StartCategory } from './start-planning-items';

let requested: StartCategory | null = null;

export function requestStartCategory(category: StartCategory): void {
  requested = category;
}

// The requested category, cleared as it is read; null when none was asked for.
export function takeStartCategory(): StartCategory | null {
  const category = requested;
  requested = null;
  return category;
}
