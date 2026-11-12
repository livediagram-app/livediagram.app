// @liveworkspace/ui/dialog-hero: the dialog hero header's frame, its parts and what art is drawn with
// (liveworkspace/docs/specs/004-index/dialog-hero-header.md). Each modal's art is its own file:
// @liveworkspace/ui/dialog-hero-art/<modal> for shared art, the product app for a product's own.
export {
  HeroBand,
  HeroDialogHeader,
  HeroTitleMark,
  type HeroDialogHeaderProps,
} from './HeroDialogHeader';
export {
  HERO_BASELINE_PX,
  HERO_DOTS_PX,
  HERO_GRID_PX,
  HERO_MOTION,
  HERO_PLACE,
  HERO_RING_PX,
  HERO_SVG,
  heroTexture,
  type HeroArt,
  type HeroOrigin,
} from './hero-art';
export {
  HERO_GROUNDS,
  HERO_INK_CONTRAST,
  HERO_TOKENS,
  HERO_TOKEN_STYLE,
  heroVar,
  resolveHeroTokens,
  type HeroRamp,
  type HeroTokenName,
} from './hero-tokens';
