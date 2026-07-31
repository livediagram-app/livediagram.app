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
//   - `@livediagram/icons/sticker-catalog` — the sticker catalogue (spec/116);
//     the editor loads it with the icon chunk, the Workers import it directly.
//   - `@livediagram/icons/resolve` — a static-import resolver for the
//     Workers, where bundle size is not user-facing.

export type { IconDef, IconPrim, TechIconDef, TechProvider } from './types';
export { xmlEscape } from './xml';
export { iconPrimMarkup, iconPrimsMarkup, techIconArtMarkup, type IconExportArt } from './markup';
export { isTechIconId, TECH_ICON_IDS } from './tech-icon-ids';
export {
  isStickerId,
  isLegacyEmojiIconId,
  LEGACY_EMOJI_ID_PREFIX,
  STICKER_ID_PREFIXES,
} from './sticker-ids';
export {
  STICKER_ASPECT,
  STICKER_TONE_COLOR,
  type StickerDef,
  type StickerTone,
} from './sticker-types';
export { stickerArt, stickerArtMarkup, type StickerArt } from './sticker-markup';
