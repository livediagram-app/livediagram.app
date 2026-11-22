import { SiteHeader } from '@liveknowledge/ui';
import { SearchInput } from '@liveworkspace/help-site/components/SearchInput';

// The help centre's header in liveknowledge's help: the shared SiteHeader (liveknowledge's ui package binds it, as
// its marketing site and Community do). The brand links back to the marketing home, the search box (and the app
// switch in it) sits in the centre slot so it is reachable from every article, and Start Blank keeps a new
// Knowledgebase a click away, tagged `Help.HeaderBlank` for the landing funnel. No ShareRail: it sits in the gutter
// beside a max-w-6xl page, and help's pages run max-w-7xl, so on an xl screen it would cover the article sidebar.
// `wide` gives the bar help's own max-w-7xl / md:px-8 column, so the logo lines up with the breadcrumb below.
export function Header() {
  return <SiteHeader ctaSurface="Help" center={<SearchInput />} shareRail={false} wide />;
}
