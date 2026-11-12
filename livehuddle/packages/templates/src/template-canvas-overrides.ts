// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop, layers, mode and kind. Its
// own module, apart from the template catalogue in templates.ts, which the editor reads (a template's title) on every
// load.
import type { FloorPattern, Tab } from '@livehuddle/document';
import { templateEditorMode } from './template-modes';
import type { TemplateKind } from './templates';

// The floor each Space is laid on (docs/specs/011-theme/floors.md), applied on top of the chosen theme (which only
// supplies the colours), explicit so it survives even a theme with no floor. A Space that grows a kind without one
// here falls through to the theme's floor, as Blank Space does.
const TEMPLATE_FLOORS: Partial<Record<TemplateKind, FloorPattern>> = {
  'virtual-office': 'carpet-tiles',
  'coworking-space': 'wood',
  'team-pod': 'carpet',
  'all-hands-hall': 'parquet',
  'focus-library': 'carpet',
  'training-room': 'carpet-tiles',
  'rooftop-bar': 'deck',
  cafe: 'terrazzo',
  'garden-retreat': 'grass',
  'city-park': 'grass',
  'company-campus': 'paving',
  'conference-venue': 'marble',
  'startup-hq': 'concrete',
  'school-quad': 'paving',
  'hotel-and-suites': 'marble',
  'coworking-tower': 'wood',
  'expo-hall': 'concrete',
  'beach-offsite': 'sand',
  'arcade-lounge': 'carpet',
  'games-night-den': 'wood',
  'sports-bar': 'wood',
  'family-house': 'wood',
  'city-townhouse': 'parquet',
  'country-cottage': 'wood',
  'music-hall': 'parquet',
  'festival-field': 'grass',
};

// Tab-level overrides a specific template ships with, applied on top of whatever theme is selected: its floor (see
// TEMPLATE_FLOORS, at full strength: a floor is already quiet) and the mode it opens in.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = {};
  const floor = TEMPLATE_FLOORS[kind];
  if (floor) overrides.backgroundPattern = floor;
  // A template's mode (docs/specs/007-editor/templates-by-mode.md): every template opens on a meeting board.
  overrides.opensIn = templateEditorMode(kind);
  return overrides;
}
