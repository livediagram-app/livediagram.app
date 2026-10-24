import {
  BRAND_APPS,
  brandLogoSvg as sharedLogoSvg,
  brandMarkSvg as sharedMarkSvg,
  type BrandApp,
  type PrismScheme,
} from '@liveworkspace/brand/svg';

// liveplanner's logo: the Living Prism and wordmark from @liveworkspace/brand, in liveplanner's colours
// (docs/specs/004-interface-design/brand-mark.md).
export const BRAND_APP = 'liveplanner' satisfies BrandApp;

export const brandMarkSvg = (options: Omit<Parameters<typeof sharedMarkSvg>[0], 'app'> = {}) =>
  sharedMarkSvg({ app: BRAND_APP, ...options });

export const brandLogoSvg = (scheme: PrismScheme) => sharedLogoSvg(BRAND_APP, scheme);

/** The app's accent as a hex colour, light and dark, for a colour that is mixed rather than named by a class. */
export const BRAND_ACCENT: Record<PrismScheme, string> = {
  light: BRAND_APPS[BRAND_APP].lockup.light.accent,
  dark: BRAND_APPS[BRAND_APP].lockup.dark.accent,
};

export {
  BRAND_MARK_VIEWBOX,
  type BrandMarkVariant,
  type PrismPalette,
  type PrismScheme,
} from '@liveworkspace/brand/svg';
