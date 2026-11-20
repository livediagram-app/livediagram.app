import { SiteSwitcher } from '@livediagram/ui';
import { SearchInput } from '@liveworkspace/help-site/components/SearchInput';
import { createSiteHeader } from '@liveworkspace/ui/site-header';
import { Brand, ExplorerLink, ShareRail, SiteAccount, StartBlankLink } from './HeaderParts';

// The All Apps help's header (liveworkspace/docs/specs/017-help/help-centre.md "Where it is shown"): the same bar as
// every app's help, @liveworkspace/ui's SiteHeader built from liveworkspace's own pieces (HeaderParts.tsx):
// liveworkspace's logo with the site switcher, the help search (and in it the app switch) in the centre, the Explorer
// link and Open liveworkspace, and the page-edge rail with the Appearance toggle (no share links, as on every app's
// help: the rail would cover the article sidebar). `wide` gives it help's max-w-7xl column.
const AllAppsSiteHeader = /* @__PURE__ */ createSiteHeader<string, 'liveworkspace.app'>({
  siteId: 'liveworkspace.app',
  SiteSwitcher,
  Brand,
  ExplorerLink,
  StartBlankLink,
  ShareRail,
  SiteAccount,
});

export function Header() {
  return <AllAppsSiteHeader center={<SearchInput />} shareRail={false} wide />;
}
