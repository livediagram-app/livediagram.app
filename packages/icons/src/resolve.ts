// Static-import icon resolver for headless renderers (the api worker's
// live image / thumbnail and the MCP worker's inline render). Importing
// this module pulls the FULL catalogue data (~60 kB) into the bundle —
// fine for a Worker, wrong for the editor's first load, which is why it
// is a separate subpath the index never re-exports. The editor builds the
// same resolver shape from its async icon-registry instead.

import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { iconPrimsMarkup, techIconArtMarkup, type IconExportArt } from './markup';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

const techById = new Map(TECH_ICON_CATALOG.map((i) => [i.id, i]));
const lineById = new Map([...ICON_CATALOG_1, ...ICON_CATALOG_2].map((i) => [i.id, i]));

// Resolve an element's `iconId` to renderable art, or undefined for an
// unknown id (the renderer then falls back to its box-with-label output).
// Tech ids win, mirroring the editor's render dispatch (isTechIconId).
export function resolveIconExportArt(iconId: string): IconExportArt | undefined {
  const tech = techById.get(iconId);
  if (tech) return { markup: techIconArtMarkup(tech), colored: true };
  const line = lineById.get(iconId);
  return line ? { markup: iconPrimsMarkup(line.prims), colored: false } : undefined;
}
