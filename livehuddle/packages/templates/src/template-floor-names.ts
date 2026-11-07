// The name of a building's first floor (docs/specs/007-editor/templates-by-mode.md "A template with floors"), the tab
// buildTemplate fills. Its own module, apart from the floors' builders (template-floors.ts), so naming a tab never
// loads every building's floors into the editor's first load.

import type { TemplateKind } from './templates';

const FIRST_FLOORS: Partial<Record<TemplateKind, string>> = {
  'hotel-and-suites': 'Lobby',
  'coworking-tower': 'Ground Floor',
  'family-house': 'Downstairs',
  'city-townhouse': 'Downstairs',
  'country-cottage': 'Downstairs',
};

/** The name of a building's first floor ("Lobby"), or null for a template on one tab. */
export function templateFirstFloorName(kind: TemplateKind): string | null {
  return FIRST_FLOORS[kind] ?? null;
}
