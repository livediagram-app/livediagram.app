// @livediagram/icons — the icon catalogues + markup builders shared by the
// editor and the headless renderers (api worker live image / thumbnail, MCP
// inline render, in-app export).
//
// This index deliberately exports ONLY the lightweight, data-free surface
// (types + markup builders). The heavy catalogue data lives behind subpath
// imports so each consumer picks its loading strategy:
//   - `@livediagram/icons/icon-catalog-1` / `icon-catalog-2` /
//     `tech-icon-catalog` — the raw data modules; the editor dynamic-imports
//     them (lib/icon-registry.ts) so they stay out of its first-load JS.
//   - `@livediagram/icons/sticker-catalog` — the sticker catalogue (docs/specs/010-palette/stickers.md);
//     the editor loads it with the icon chunk, the Workers import it directly.
//   - `@livediagram/icons/resolve` — a static-import resolver for the
//     Workers, where bundle size is not user-facing.

export type { IconDef, IconPrim, PrimStyle, StyledPrim, TechIconDef, TechProvider } from './types';
export { xmlEscape } from './xml';
export { matches, paletteRank } from './search-rank';
export {
  inkInsets,
  pathBounds,
  primBounds,
  primsBounds,
  unionBounds,
  type Bounds,
  type InkInsets,
} from './ink';
export {
  GLYPH_SIZES,
  ICON_SMALL_MAX_PX,
  ICON_STROKE_PX,
  ICON_STROKE_PX_SMALL,
  glyphStrokePx,
  strokeUnits,
  type GlyphSize,
} from './weight';
export { CAP_HEIGHT_EM, capBandBaselineY } from './svg-cap-band';
export {
  iconPrimsMarkup,
  techGlyphStrokeUnits,
  techIconArtMarkup,
  type IconExportArt,
} from './markup';
export { isTechIconId, TECH_ICON_IDS } from './tech-icon-ids';
export { isStickerId, isLegacyEmojiIconId } from './sticker-ids';
export { STICKER_ASPECT, type StickerDef, type StickerTone } from './sticker-types';
export { stickerArt, type StickerArt } from './sticker-markup';
