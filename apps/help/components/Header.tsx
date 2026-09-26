import { ctaHref } from '@livediagram/api-schema';
import { buttonClassName, SiteHeader } from '@livediagram/ui';
import { SearchInput } from '@/components/SearchInput';

// Help-centre header: the shared SiteHeader (packages/ui, also marketing's and
// the dashboard's) keyed to Help in the apps menu. Brand links back to the
// marketing home, the search box sits in the centre slot so it's reachable
// from every article (not just the home hero), and the one CTA keeps the
// editor a click away (the canvas works without signing in, spec/04). Same
// origin as the rest of livediagram, so these are plain absolute links. No
// ShareRail: it sits in the gutter beside a max-w-6xl page, and help's pages
// run max-w-7xl, so on an xl screen it would cover the article sidebar.
// `wide` gives the bar help's own max-w-7xl / md:px-8 column, so the logo
// lines up with the breadcrumb and article below.
export function Header() {
  return (
    <SiteHeader
      productNav="help"
      center={<SearchInput />}
      shareRail={false}
      wide
      actions={
        <a
          href={ctaHref('/new', 'Help.Header')}
          className={buttonClassName({ size: 'md', className: 'shrink-0 shadow-sm' })}>
          Start drawing
        </a>
      }
    />
  );
}
