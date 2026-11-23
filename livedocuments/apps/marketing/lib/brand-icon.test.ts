import { brandLogoSvg, brandMarkSvg } from '@livedocuments/ui';
import { describeBrandIcon } from '@liveworkspace/marketing-site/lib/brand-icon-testing';

// The icon and logo files `pnpm icons:brand` writes, held to the Living Prism module in @livedocuments/ui: the suite every
// product's marketing app runs.
describeBrandIcon({
  product: 'livedocuments',
  repo: new URL('../../../', import.meta.url),
  editorApp: 'editor',
  brandMarkSvg,
  brandLogoSvg,
});
