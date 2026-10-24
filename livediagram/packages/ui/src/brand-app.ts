import {
  brandLogoSvg as sharedLogoSvg,
  brandMarkSvg as sharedMarkSvg,
  type BrandApp,
  type PrismScheme,
} from '@liveworkspace/brand/svg';

// livediagram's logo: the Living Prism and wordmark from @liveworkspace/brand, in livediagram's colours
// (docs/specs/004-interface-design/brand-mark.md).
export const BRAND_APP = 'livediagram' satisfies BrandApp;

export const brandMarkSvg = (options: Omit<Parameters<typeof sharedMarkSvg>[0], 'app'> = {}) =>
  sharedMarkSvg({ app: BRAND_APP, ...options });

export const brandLogoSvg = (scheme: PrismScheme) => sharedLogoSvg(BRAND_APP, scheme);

export {
  BRAND_MARK_VIEWBOX,
  type BrandMarkVariant,
  type PrismPalette,
  type PrismScheme,
} from '@liveworkspace/brand/svg';
