// For a renderer outside the editor (the api's thumbnails, the MCP server's previews): load and provide the map
// geometry before drawing a tab that has a map (docs/specs/009-elements/map.md "Exports and other surfaces"). A
// dynamic import, so a bundle that never draws a map never carries it, and a tab without one never loads it.

import type { Element } from './index';
import { provideMapGeometry, providedMapGeometry } from './map-model';

export async function ensureMapGeometry(elements: readonly Element[]): Promise<void> {
  if (providedMapGeometry()) return;
  if (!elements.some((el) => el.type === 'shape' && el.shape === 'map')) return;
  const { MAP_GEOMETRY } = await import('./map-geometry.generated');
  provideMapGeometry(MAP_GEOMETRY);
}
