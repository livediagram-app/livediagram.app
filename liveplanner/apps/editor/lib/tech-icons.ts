// Full-colour brand icons for the "Technology" palette category
// (docs/specs/010-palette/technology-icons.md) — the AWS / Azure / generic-infrastructure marks people put
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
// redistributing vendors' proprietary SVGs (docs/specs/002-project-scope/third-party-licences.md). Swapping in a vendor's official SVG later is a per-id edit.
//
// This module is the SYNCHRONOUS API surface only. The heavy per-icon data
// (colour + SVG markup) lives in @liveplanner/icons/tech-icon-catalog and
// loads as an async chunk through lib/icon-registry.ts, keeping ~25 kB out
// of the editor's first-load JS. Nothing here may import the data module
// statically.

// The catalogue types live in @liveplanner/icons (shared with the Workers'
// headless renders); re-exported so existing import sites keep resolving.
export type { TechIconDef, TechProvider } from '@liveplanner/icons';

// The tech-icon id set + `isTechIconId` live in @liveplanner/icons
// (tech-icon-ids.ts) so the project package's connector geometry can use
// them too (a tech icon's arrows attach to its fixed-size mark, docs/specs/010-palette/technology-icons.md);
// re-exported so existing import sites keep resolving. Still a lightweight
// first-load module — only the colour/glyph data waits on the async chunk.
export { isTechIconId, TECH_ICON_IDS } from '@liveplanner/icons';
