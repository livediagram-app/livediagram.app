import type { CtaSurface } from '@livehuddle/api-schema';
import { createSiteHeader } from '@liveworkspace/ui/site-header';
import { Brand } from './Brand';
import { ExplorerLink } from './ExplorerLink';
import { HeaderPrimaryCta } from './HeaderPrimaryCta';
import { ShareRail } from './ShareRail';
import { SiteAccount } from './SiteAccount';
import { SITE_ID } from './site';
import { SiteSwitcher } from './SiteSwitcher';
import { StartBlankLink } from './StartBlankLink';

// The public site header (docs/specs/019-marketing/marketing-site.md "Header"), shared by the marketing
// pages, the help centre and the dashboard so they read as one product: @liveworkspace/ui's, with this
// product's logo and switcher, its CTA links on its funnel vocabulary, its Explorer link, rail and account
// menu. Its props (ctaSurface, center, actions, buildWithAi, shareRail, wide, account) are described there.
export const SiteHeader = /* @__PURE__ */ createSiteHeader<CtaSurface, typeof SITE_ID>({
  siteId: SITE_ID,
  SiteSwitcher,
  Brand,
  ExplorerLink,
  HeaderPrimaryCta,
  StartBlankLink,
  ShareRail,
  SiteAccount,
});
