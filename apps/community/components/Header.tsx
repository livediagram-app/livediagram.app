import { SiteHeader } from '@livediagram/ui';

// The Community app's header: the shared SiteHeader (packages/ui, also marketing's, help's and the
// dashboard's) keyed to Community in the apps menu, with the default CTA pair tagged for the landing
// funnel as `Community.Header*` (docs/specs/019-marketing/landing-funnel.md). `wide` matches the
// app's max-w-7xl pages, so the logo lines up with the hero below, and keeps the page-edge rail (its Appearance
// toggle; sharing is off, like help's) until 2xl, where there is a gutter for it beside the grid.
export function Header() {
  return <SiteHeader productNav="community" ctaSurface="Community" wide shareRail={false} />;
}
