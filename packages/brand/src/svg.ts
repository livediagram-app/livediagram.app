// The logo as plain strings and data, for scripts, image routes and the social card.
export { BRAND_APPS, type BrandApp, type BrandIdentity, type BrandStep } from './apps';
export { BRAND_MARK_VIEWBOX, brandMarkSvg, type BrandMarkVariant } from './geometry';
export { brandLogoSvg } from './logo-svg';
export {
  PRISM_STOPS,
  prismPalette,
  prismPalettes,
  type PrismPalette,
  type PrismScheme,
  type PrismStop,
} from './prism';
// The prism's faces and their turn and opening (pure, no React), for a drawing made outside the DOM: a canvas texture.
export { BRAND_GRADIENTS, type BrandGradient } from './geometry';
export {
  easeOutCubic,
  PRISM_OPEN_MS,
  PRISM_SETTLE_MS,
  PRISM_SPIN_DEG_PER_S,
  PRISM_SPIN_RAMP_MS,
  prismFrame,
  restingTurn,
  settleTurn,
  type PrismFrame,
  type PrismSide,
} from './motion';
