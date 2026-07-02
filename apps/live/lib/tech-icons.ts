// Full-colour brand icons for the "Technology" palette category
// (spec/41) — the AWS / Azure / generic-infrastructure marks people put
// on system-architecture diagrams. They are a DELIBERATELY separate
// catalogue from the line-art glyphs in `icons.ts`: those are
// single-weight strokes tinted by the element's stroke colour, whereas
// these are fixed multi-colour brand marks that must NOT be recoloured
// (an orange Lambda only reads as Lambda in orange).
//
// A Technology icon reuses the `shape: 'icon'` element — `element.iconId`
// keys here instead of the line-art catalogue. The render path
// (BoxedElementView → tech-icon-glyph) dispatches on `isTechIconId` so the
// id resolves to the right renderer; an id in neither catalogue still
// falls back to the line-art placeholder.
//
// Each mark is authored in-repo as a brand-coloured rounded tile + a white
// line-art glyph (the AWS resource-icon visual language, applied uniformly
// for a cohesive palette). It is NOT the verbatim vendor asset pack — that
// keeps the bundle small, renders crisply at icon size, and avoids
// redistributing proprietary SVGs from a public MIT repo (spec/03,
// spec/06). Swapping in a vendor's official SVG later is a per-id edit.
//
// This module is the SYNCHRONOUS API surface only. The heavy per-icon data
// (colour + SVG markup) lives in @livediagram/icons/tech-icon-catalog and
// loads as an async chunk through lib/icon-registry.ts, keeping ~25 kB out
// of the editor's first-load JS. Nothing here may import the data module
// statically.

import type { TechIconDef, TechProvider } from '@livediagram/icons';
import { getLoadedTechIconCatalog, getTechIconLoaded } from './icon-registry';

// The catalogue types live in @livediagram/icons (shared with the Workers'
// headless renders); re-exported so existing import sites keep resolving.
export type { TechIconDef, TechProvider } from '@livediagram/icons';

// Drag-from-palette MIME for a Technology tile dropped on the canvas.
// Distinct from ICON_DND_MIME so the tile creates a STANDALONE icon
// element and is ignored by the shape drop-target (a coloured brand tile
// beside a shape's text is meaningless, and the inline-icon renderer only
// knows line-art prims). Value carried = the tech-icon id.
export const TECH_ICON_DND_MIME = 'application/x-livediagram-tech-icon';

// Provider display names for the palette filter + tooltips.
export const TECH_PROVIDERS: { id: TechProvider; label: string }[] = [
  { id: 'aws', label: 'AWS' },
  { id: 'azure', label: 'Azure' },
  { id: 'cloudflare', label: 'Cloudflare' },
  { id: 'firebase', label: 'Firebase' },
  { id: 'generic', label: 'Generic' },
];

// The tech-icon id set + `isTechIconId` live in @livediagram/icons
// (tech-icon-ids.ts) so the diagram package's connector geometry can use
// them too (a tech icon's arrows attach to its fixed-size mark, spec/41);
// re-exported so existing import sites keep resolving. Still a lightweight
// first-load module — only the colour/glyph data waits on the async chunk.
export { isTechIconId, TECH_ICON_IDS } from '@livediagram/icons';

// Resolves the full definition (colour + glyph markup). Returns undefined for
// an unknown id AND until the async catalogue chunk has loaded — check
// `isTechIconId` to tell "not a tech icon" from "data still in flight"
// (tech-icon-glyph.tsx uses exactly that split to paint a skeleton tile).
export function getTechIcon(id: string | undefined): TechIconDef | undefined {
  return getTechIconLoaded(id);
}

// Case-insensitive search over label + keywords + id, optionally narrowed
// to one provider. Empty query returns the (filtered) catalogue. Empty
// result set until the catalogue chunk loads — the picker subscribes via
// useIconCatalogs and re-runs the search when the data lands.
export function searchTechIcons(query: string, provider: TechProvider | 'all'): TechIconDef[] {
  const catalog = getLoadedTechIconCatalog();
  const base = provider === 'all' ? catalog : catalog.filter((i) => i.provider === provider);
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      i.keywords.includes(q) ||
      i.id.includes(q) ||
      i.provider.includes(q),
  );
}
