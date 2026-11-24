import { brandLogoSvg, brandMarkSvg } from '@liveknowledge/ui';
import { describeBrandIcon } from '@liveworkspace/marketing-site/lib/brand-icon-testing';

// The icon and logo files `pnpm icons:brand` writes, held to the Living Prism module in @liveknowledge/ui: the suite every
// product's marketing app runs.
describeBrandIcon({
  product: 'liveknowledge',
  repo: new URL('../../../', import.meta.url),
  editorApp: 'editor',
  brandMarkSvg,
  brandLogoSvg,
});
