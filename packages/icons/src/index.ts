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
//   - `@livediagram/icons/resolve` — a static-import resolver for the
//     Workers, where bundle size is not user-facing.

export type { IconDef, IconPrim, TechIconDef, TechProvider } from './types';
export { iconPrimMarkup, iconPrimsMarkup, techIconArtMarkup, type IconExportArt } from './markup';
