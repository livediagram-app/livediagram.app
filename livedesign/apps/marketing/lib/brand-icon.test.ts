import { brandLogoSvg, brandMarkSvg } from '@livedesign/ui';
import { describeBrandIcon } from '@liveworkspace/marketing-site/lib/brand-icon-testing';

// The icon and logo files `pnpm icons:brand` writes, held to the Living Prism module in @livedesign/ui: the suite every
// product's marketing app runs.
describeBrandIcon({
  product: 'livedesign',
  repo: new URL('../../../', import.meta.url),
  editorApp: 'live',
  brandMarkSvg,
  brandLogoSvg,
});
