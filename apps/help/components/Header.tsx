import { SiteHeader } from '@livediagram/ui';
import { SearchInput } from '@/components/SearchInput';

// Help-centre header: the shared SiteHeader (packages/ui, also marketing's and
// the dashboard's) keyed to Help in the apps menu. Brand links back to the
// marketing home, the search box sits in the centre slot so it's reachable
// from every article (not just the home hero), and the landing page's own CTA
// pair (Start Blank menu + Choose Template) keeps the editor a click away (the
// canvas works without signing in, docs/specs/014-identity/auth-and-guest-access.md),
// tagged `Help.Header*` for the landing funnel. No
// ShareRail: it sits in the gutter beside a max-w-6xl page, and help's pages
// run max-w-7xl, so on an xl screen it would cover the article sidebar.
// `wide` gives the bar help's own max-w-7xl / md:px-8 column, so the logo
// lines up with the breadcrumb and article below.
export function Header() {
  return (
    <SiteHeader
      productNav="help"
      ctaSurface="Help"
      center={<SearchInput />}
      shareRail={false}
      wide
    />
  );
}
