import type { IconDef, TechIconDef } from '@livediagram/icons';
import { getIconCatalog } from '@/lib/icons';
import { getTechIcon, searchTechIcons } from '@/lib/tech-icons';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { tileById, type PaletteTileDef } from './palette-tile-defs';

// Dynamic favourite tiles (spec/78): individual Icons / Technology catalogue
// entries promoted to palette tiles. Unlike the fixed creation tiles these
// aren't listed in PALETTE_TILES — the catalogues are open-ended and load
// async (lib/icon-registry) — so a favourited icon persists as a PREFIXED id
// (`icon:<iconId>` / `tech:<iconId>`) and resolves to a tile def at render
// time, once the catalogue chunk is in. The persistence layer keeps prefixed
// ids verbatim (see lib/palette-favourites) precisely because they can't be
// validated before that chunk lands.

export const ICON_FAVOURITE_PREFIX = 'icon:';
export const TECH_FAVOURITE_PREFIX = 'tech:';

export function iconTileDef(icon: IconDef): PaletteTileDef {
  return {
    id: `${ICON_FAVOURITE_PREFIX}${icon.id}`,
    section: 'icons',
    label: `Add ${icon.label}`,
    description: 'Drops this icon at the viewport centre, tinted by the element stroke.',
    action: { type: 'icon', iconId: icon.id },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <IconPrims iconId={icon.id} />
      </svg>
    ),
  };
}

export function techTileDef(icon: TechIconDef): PaletteTileDef {
  return {
    id: `${TECH_FAVOURITE_PREFIX}${icon.id}`,
    section: 'technology',
    label: `Add ${icon.label}`,
    caption: icon.short ?? icon.label,
    description: 'Drops this technology icon on the canvas.',
    // Full-colour brand art keeps its own colours under any theme.
    noTint: true,
    action: { type: 'tech-icon', iconId: icon.id },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <TechIconArt iconId={icon.id} />
      </svg>
    ),
  };
}

// Search each catalogue for the edit-favourites dialog. Line icons match the
// same fields the Icons tab searches (label / keywords / id); tech icons
// reuse the Technology tab's search.
export function searchIconTiles(query: string): PaletteTileDef[] {
  const q = query.trim().toLowerCase();
  return getIconCatalog()
    .filter(
      (i) => !q || i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q),
    )
    .map(iconTileDef);
}

export function searchTechTiles(query: string): PaletteTileDef[] {
  return searchTechIcons(query, 'all').map(techTileDef);
}

// A favourite id → its tile def: fixed catalogue ids resolve through
// PALETTE_TILES, prefixed ids through the icon catalogues. Returns undefined
// for a stale id — and for a dynamic id whose catalogue chunk hasn't loaded
// yet, so callers gate their empty states on the load flag (useIconCatalogs).
export function resolveFavouriteTile(id: string): PaletteTileDef | undefined {
  if (id.startsWith(ICON_FAVOURITE_PREFIX)) {
    const iconId = id.slice(ICON_FAVOURITE_PREFIX.length);
    const icon = getIconCatalog().find((i) => i.id === iconId);
    return icon ? iconTileDef(icon) : undefined;
  }
  if (id.startsWith(TECH_FAVOURITE_PREFIX)) {
    const icon = getTechIcon(id.slice(TECH_FAVOURITE_PREFIX.length));
    return icon ? techTileDef(icon) : undefined;
  }
  return tileById(id);
}
